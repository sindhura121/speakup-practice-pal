// Production AI: Lovable AI Gateway (server-only). Mock logic lives in mock.server.ts.
import { createParser } from "eventsource-parser";

const BASE = "https://ai.gateway.lovable.dev/v1";
export const CHAT_MODEL = "openai/gpt-6-astra";
export const TRANSCRIBE_MODEL = "openai/gpt-transcribe";

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function hasAi() {
  return Boolean(process.env["LOVABLE_API_KEY"]);
}

function key() {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new AiError("AI is not configured", 401);
  return k;
}

function friendly(status: number, body: string) {
  if (status === 402) return "AI credits are used up. Please top up to keep getting feedback.";
  if (status === 429) return "Too many requests right now. Please wait a moment and try again.";
  if (status === 403) return "AI access is currently blocked for this workspace.";
  try {
    const j = JSON.parse(body);
    return j?.error?.message ?? j?.message ?? `AI request failed (${status})`;
  } catch {
    return `AI request failed (${status})`;
  }
}

export type JsonSchema = Record<string, unknown>;

/** Strict schema helpers: every property required, no extras. */
export const S = {
  str: (description?: string): JsonSchema => ({ type: "string", ...(description ? { description } : {}) }),
  num: (description?: string): JsonSchema => ({ type: "number", ...(description ? { description } : {}) }),
  int: (description?: string): JsonSchema => ({ type: "integer", ...(description ? { description } : {}) }),
  arr: (items: JsonSchema): JsonSchema => ({ type: "array", items }),
  obj: (properties: Record<string, JsonSchema>): JsonSchema => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }),
};

type InputPart = { type: "input_text"; text: string } | { type: "input_image"; image_url: string };

/** Streams a Responses call with strict JSON output and returns the parsed object. */
export async function aiJson<T>(opts: {
  name: string;
  system: string;
  user: string | InputPart[];
  schema: JsonSchema;
  effort?: "low" | "medium";
}): Promise<T> {
  const res = await fetch(`${BASE}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: true,
      store: false,
      reasoning: { effort: opts.effort ?? "low" },
      instructions: opts.system,
      input: [
        {
          role: "user",
          content: typeof opts.user === "string" ? [{ type: "input_text", text: opts.user }] : opts.user,
        },
      ],
      text: { format: { type: "json_schema", name: opts.name, schema: opts.schema, strict: true } },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    console.error("AI gateway error", res.status, body.slice(0, 500));
    throw new AiError(friendly(res.status, body), res.status);
  }
  let text = "";
  let failure: string | null = null;
  let refused = false;
  const parser = createParser({
    onEvent(ev) {
      if (!ev.data || ev.data === "[DONE]") return;
      try {
        const d = JSON.parse(ev.data);
        if (d.type === "response.output_text.delta") text += d.delta ?? "";
        else if (d.type === "response.refusal.delta") refused = true;
        else if (d.type === "response.failed" || d.type === "error")
          failure = d.response?.error?.message ?? d.error?.message ?? d.message ?? "AI request failed";
      } catch {
        /* ignore partial */
      }
    },
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(dec.decode(value, { stream: true }));
  }
  if (refused) throw new AiError("The AI declined to answer this request.", 400);
  if (failure) throw new AiError(failure, 502);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError("The AI returned an incomplete answer. Please try again.", 502);
  }
}

export const TTS_MODEL = "google/gemini-3.1-flash-tts-preview";

/** Clear, natural Gemini voices mapped per personality. */
const TTS_VOICES: Record<string, string> = {
  aggressive: "Charon",
  logical: "Iapetus",
  calm: "Kore",
  analytical: "Algieba",
  devils_advocate: "Rasalgethi",
  beginner: "Leda",
  expert: "Orus",
  moderator: "Aoede",
  quiet: "Callirrhoe",
  fact_based: "Iapetus",
  balanced: "Kore",
  creative: "Puck",
  skeptic: "Charon",
  practical: "Algieba",
  interviewer: "Aoede",
};

/** Streams text-to-speech (SSE of base64 PCM) from the gateway. */
export function speakText(text: string, personality = ""): Promise<Response> {
  const voice = TTS_VOICES[personality] ?? "Kore";
  return fetch(`${BASE}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
      stream_format: "sse",
    }),
  });
}

export async function transcribeAudio(file: File): Promise<Response> {
  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("file", file, file.name);
  form.append("response_format", "json");
  form.append("stream", "true");
  form.append("prompt", "Transcribe verbatim, keeping filler words like um, uh, like, you know.");
  return fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}` },
    body: form,
  });
}

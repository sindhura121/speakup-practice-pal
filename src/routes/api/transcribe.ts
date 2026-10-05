import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MAX_BYTES = 24 * 1024 * 1024;

async function verify(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await sb.auth.getUser(token);
  return data.user ?? null;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await verify(request);
        if (!user) return json({ error: "Please sign in again." }, 401);
        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > MAX_BYTES) return json({ error: "Recording is too long to transcribe." }, 413);
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size < 2048) return json({ error: "Recording was empty. Please try again." }, 400);
        if (file.size > MAX_BYTES) return json({ error: "Recording is too long to transcribe." }, 413);
        const { hasAi, transcribeAudio } = await import("@/lib/ai/gateway.server");
        if (!hasAi()) {
          // Mock fallback: no transcription available without AI.
          return json({ text: "[Transcription unavailable in development mode — AI is not configured.]" }, 200);
        }
        const upstream = await transcribeAudio(file);
        if (!upstream.ok) {
          const body = await upstream.text();
          console.error("transcribe failed", upstream.status, body.slice(0, 400));
          const msg =
            upstream.status === 402
              ? "AI credits are used up."
              : upstream.status === 429
                ? "Too many requests. Please wait a moment."
                : "We couldn't transcribe that recording. Please try again.";
          return json({ error: msg }, upstream.status);
        }
        return new Response(upstream.body, {
          status: 200,
          headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});

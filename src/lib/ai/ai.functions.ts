import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiJson, hasAi, S, AiError } from "./gateway.server";
import { mockPrompt, mockSpeechFeedback, mockTurn, mockConversationFeedback } from "./mock.server";
import { isTooSimilar } from "./similarity";
import type { AudioMetrics, ConvMessage, ConversationFeedback, SpeechFeedback } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof AiError ? e.message : "Something went wrong. Please try again." };
  }
}

/* ------------------------------ PROMPT ENGINE ------------------------------ */

const PROMPT_STYLES = [
  "a bold one-sentence claim to argue for or against",
  "an open question that invites personal opinion",
  "a 'would you rather' style dilemma",
  "a short hypothetical scenario ('Imagine…') ending in a question",
  "a nuanced statement with a trade-off ('X, but Y')",
  "a question asking the speaker to explain or persuade",
];

const KIND_BRIEF: Record<string, string> = {
  speaking: "an impromptu speaking prompt",
  debate: "a debatable motion phrased as a single clear statement that has strong arguments on both sides (no question mark)",
  gd: "a group-discussion topic phrased as a statement or open question with many angles",
  picture: "an impromptu speaking prompt",
};

export const generatePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mode: string; category?: string | null; difficulty: string }) => d)
  .handler(async ({ data, context }) =>
    safe(async () => {
      const { data: hist } = await context.supabase
        .from("prompt_history")
        .select("prompt, core_idea")
        .order("created_at", { ascending: false })
        .limit(250);
      const history = (hist ?? []).flatMap((h) => [h.prompt, h.core_idea ?? ""]).filter(Boolean);
      let chosen: { prompt: string; core_idea: string } | null = null;

      if (hasAi()) {
        const style = PROMPT_STYLES[Math.floor(Math.random() * PROMPT_STYLES.length)];
        const seed = Math.random().toString(36).slice(2, 8);
        for (let attempt = 0; attempt < 2 && !chosen; attempt++) {
          const out = await aiJson<{ candidates: { prompt: string; core_idea: string }[] }>({
            name: "prompts",
            system:
              "You write fresh, specific, natural-sounding English speaking prompts for a communication-practice app. Every prompt must be a complete sentence or question, never a bare category. Avoid clichés and avoid any idea semantically close to the user's history (same core proposition with different wording counts as a duplicate).",
            user: [
              `Write 6 candidates of ${KIND_BRIEF[data.mode] ?? KIND_BRIEF.speaking}.`,
              `Preferred style for most candidates: ${style}.`,
              `Difficulty: ${data.difficulty} (beginner = everyday, simple vocabulary; advanced = abstract, nuanced, policy or philosophical).`,
              data.category ? `Category filter: ${data.category}. Explore a surprising sub-angle of it.` : "Category: any — pick varied, unexpected domains.",
              `Variation seed: ${seed}.`,
              "core_idea: 3–8 words naming the underlying proposition (e.g. 'AI use for schoolwork').",
              history.length ? `The user has ALREADY practiced these — do not repeat or paraphrase their ideas:\n- ${history.slice(0, 300).join("\n- ")}` : "",
            ].join("\n"),
            schema: S.obj({ candidates: S.arr(S.obj({ prompt: S.str(), core_idea: S.str() })) }),
          });
          chosen =
            out.candidates.find(
              (c) => c.prompt.length > 15 && !isTooSimilar(c.prompt, history) && !isTooSimilar(c.core_idea, history, 0.75),
            ) ?? null;
        }
      }
      if (!chosen) chosen = mockPrompt(history);
      await context.supabase.from("prompt_history").insert({ mode: data.mode, prompt: chosen.prompt, core_idea: chosen.core_idea });
      return chosen;
    }),
  );

export const generateStoryElements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { difficulty: string }) => d)
  .handler(async ({ data, context }) =>
    safe(async () => {
      const { data: hist } = await context.supabase.from("prompt_history").select("prompt").eq("mode", "storytelling").order("created_at", { ascending: false }).limit(60);
      const used = (hist ?? []).map((h) => h.prompt);
      let out: { words: string[]; situation: string };
      if (hasAi()) {
        out = await aiJson({
          name: "story",
          system: "You create storytelling challenges. Pick concrete, unrelated, vivid nouns that are fun to combine.",
          user: `Difficulty ${data.difficulty}. Give exactly 3 random words and a one-sentence situation starter. Avoid these previous sets: ${used.join(" | ") || "none"}. Seed ${Math.random()}`,
          schema: S.obj({ words: S.arr(S.str()), situation: S.str() }),
        });
      } else {
        const pool = ["Rain", "Train", "Laptop", "Lighthouse", "Violin", "Passport", "Cactus", "Elevator", "Map", "Kite", "Clock", "Bakery"];
        out = { words: pool.sort(() => Math.random() - 0.5).slice(0, 3), situation: "Someone receives an unexpected message." };
      }
      await context.supabase.from("prompt_history").insert({ mode: "storytelling", prompt: `${out.words.join(", ")} — ${out.situation}` });
      return out;
    }),
  );

/* ------------------------------ SPEECH ANALYSIS ----------------------------- */

const SCORE = S.int("0-100");
const speechSchema = S.obj({
  overall: SCORE,
  scores: S.obj({ fluency: SCORE, grammar: SCORE, vocabulary: SCORE, pronunciation: SCORE, clarity: SCORE, confidence: SCORE, content: SCORE }),
  extra_scores: S.arr(S.obj({ label: S.str(), score: SCORE })),
  summary: S.str(),
  strengths: S.arr(S.str()),
  improvements: S.arr(S.str()),
  rewrites: S.arr(S.obj({ original: S.str("exact sentence from transcript"), better: S.str() })),
  filler_words: S.arr(S.obj({ word: S.str(), count: S.int() })),
  grammar_issues: S.arr(S.obj({ text: S.str("exact substring of the transcript"), correction: S.str(), explanation: S.str() })),
  repeated_words: S.arr(S.obj({ word: S.str(), count: S.int() })),
  vocab_suggestions: S.arr(S.obj({ word: S.str("exact word from transcript"), alternatives: S.arr(S.str()) })),
  pronunciation_notes: S.arr(S.str()),
  delivery: S.obj({ pace: S.str(), tone: S.str(), confidence: S.str() }),
  content_notes: S.obj({ relevance: S.str(), organization: S.str(), examples: S.str() }),
  recommendation: S.str("one specific next practice exercise"),
});

const MODE_EXTRAS: Record<string, string> = {
  storytelling: "extra_scores must include: Creativity, Story structure, Beginning, Development, Ending, Use of required words.",
  picture: "extra_scores must include: Observation, Detail, Organization. Judge accuracy against the attached image.",
  speaking: "extra_scores must include: Relevance, Logical flow, Use of examples.",
};

export const analyzeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { mode: string; prompt: string; transcript: string; metrics: AudioMetrics; difficulty: string; imageUrl?: string | null; targetSec: number }) => d,
  )
  .handler(async ({ data }) =>
    safe(async () => {
      if (!data.transcript.trim()) throw new AiError("We couldn't hear any speech. Please try again closer to the mic.", 400);
      if (!hasAi()) return mockSpeechFeedback(data.transcript, data.metrics);
      const text = [
        `Mode: ${data.mode}. Level: ${data.difficulty}. Target speaking time: ${data.targetSec}s.`,
        `Prompt: "${data.prompt}"`,
        `Measured audio metrics (reliable, from the waveform): duration ${data.metrics.durationSec}s, voiced ${data.metrics.speakingSec}s, long pauses (>2s): ${data.metrics.longPauses}, longest pause ${data.metrics.longestPauseSec}s, ${data.metrics.wordCount} words, ${data.metrics.wpm} wpm.`,
        MODE_EXTRAS[data.mode] ?? MODE_EXTRAS.speaking,
        `Transcript:\n"""${data.transcript}"""`,
      ].join("\n");
      const fb = await aiJson<SpeechFeedback>({
        name: "speech_feedback",
        effort: "medium",
        system:
          "You are an expert, encouraging but honest English communication coach. Analyse the spoken transcript in depth: fluency (pauses, hesitation, continuity), grammar (tense, articles, prepositions, sentence construction), vocabulary (range, repetition, better words), pronunciation (infer only from transcription artefacts; say when it cannot be judged), delivery (pace vs 130-160 wpm ideal, confidence indicators), content (relevance, ideas, examples, organisation, logical flow). Count filler words exactly as they appear (um, uh, like, actually, basically, you know, I think, so, kind of, literally). Quote exact substrings for grammar_issues, rewrites and vocab words. Be specific with numbers ('You said \"I think\" 6 times'). Penalise very short answers relative to the target time. Give 3-5 strengths, 3-5 improvements, 2-4 rewrites.",
        user: data.imageUrl ? [{ type: "input_text", text }, { type: "input_image", image_url: data.imageUrl }] : text,
        schema: speechSchema,
      });
      return { ...fb, metrics: data.metrics };
    }),
  );

/* ------------------------------ CONVERSATIONS ------------------------------- */

const PERSONA_GUIDE: Record<string, string> = {
  logical: "structured, numbered reasoning, calm precision",
  aggressive: "assertive, interrupts with sharp challenges, demands evidence, short punchy sentences",
  calm: "composed, polite, measured counterpoints",
  analytical: "trade-offs, second-order effects, cites plausible data carefully",
  devils_advocate: "takes the uncomfortable contrarian angle and probes assumptions",
  beginner: "simple vocabulary, short points, occasionally weak arguments",
  expert: "deep domain knowledge, precise terminology, surgical rebuttals",
  moderator: "introduces the topic, invites quieter people, summarises, manages time, never takes sides",
  quiet: "speaks briefly (1-2 sentences) but makes one insightful point",
  fact_based: "uses statistics and evidence (plausible, hedged)",
  balanced: "connects others' ideas, finds middle ground, keeps flow",
  creative: "unexpected analogies and fresh angles",
  skeptic: "questions assumptions and asks 'how do we know?'",
  practical: "focuses on implementation, cost, real-world examples",
  interviewer: "professional interviewer who asks one question at a time and probes the previous answer",
};

export const conversationTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      kind: "debate" | "gd" | "interview";
      topic: string;
      userName: string;
      userSide?: string | null;
      interviewType?: string | null;
      responders: { name: string; personality: string; side?: string | null }[];
      history: ConvMessage[];
      phase: "open" | "reply" | "close";
    }) => d,
  )
  .handler(async ({ data }) =>
    safe(async () => {
      if (!hasAi()) return { messages: mockTurn(data.responders, data.history.at(-1)) };
      const roster = data.responders
        .map((r) => `- ${r.name}: ${PERSONA_GUIDE[r.personality] ?? r.personality}${r.side ? `; argues ${r.side.toUpperCase()} the motion` : ""}`)
        .join("\n");
      const brief =
        data.kind === "debate"
          ? `This is a live spoken debate on the motion: "${data.topic}". ${data.userName} argues ${String(data.userSide ?? "").toUpperCase()}. AI debaters must NOT simply agree; they present arguments, challenge specific claims the human made, point out weak logic, ask pointed questions, request clarification, and introduce opposing evidence.`
          : data.kind === "gd"
            ? `This is a realistic group discussion on: "${data.topic}". Participants react to each other by name, build on or challenge prior points, and leave room for ${data.userName} to contribute. Not every participant needs to speak every turn; the quiet one rarely speaks.`
            : `This is a ${data.interviewType ?? "HR"} job interview with ${data.userName}. Ask exactly one question per turn. Base each follow-up on the candidate's previous answer (probe vague claims, ask for examples, metrics, or STAR structure). Vary topics over time.`;
      const phaseNote =
        data.phase === "open"
          ? "Generate the opening turn(s)."
          : data.phase === "close"
            ? "Generate brief closing remarks (moderator summarises if present)."
            : `Respond to the latest contribution from ${data.userName}.`;
      const out = await aiJson<{ messages: { speaker: string; content: string }[] }>({
        name: "turn",
        system: `You voice multiple distinct AI participants in a spoken communication-practice session. Each speaker has a clearly different voice and style. Replies are spoken aloud, so keep each to 1-4 natural sentences (no lists, no markdown). Only use speaker names from the roster.\n${brief}\nRoster:\n${roster}`,
        user: `${phaseNote}\nTranscript so far:\n${data.history.map((m) => `${m.speaker}: ${m.content}`).join("\n") || "(nothing yet)"}`,
        schema: S.obj({ messages: S.arr(S.obj({ speaker: S.str(), content: S.str() })) }),
      });
      const names = new Map(data.responders.map((r) => [r.name, r.personality]));
      return {
        messages: out.messages
          .filter((m) => names.has(m.speaker) && m.content.trim())
          .map((m) => ({ ...m, personality: names.get(m.speaker) })),
      };
    }),
  );

export const evaluateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { kind: "debate" | "gd" | "interview"; topic: string; userName: string; userSide?: string | null; history: ConvMessage[]; sharePct: number; interviewType?: string | null }) => d,
  )
  .handler(async ({ data }) =>
    safe(async () => {
      if (!hasAi()) return mockConversationFeedback();
      const metricList =
        data.kind === "debate"
          ? "Argument quality, Relevance, Logic, Counterarguments, Rebuttals, Persuasiveness, Response speed, Vocabulary, Fluency, Grammar, Confidence, Listening, Staying on topic"
          : data.kind === "gd"
            ? "Communication, Fluency, Grammar, Vocabulary, Confidence, Listening, Turn-taking, Participation, Leadership, Teamwork, Relevance, Argument quality, Building on others, New ideas, Speaking balance"
            : "Answer quality, Confidence, Clarity, Grammar, Fluency, Relevance, Structure, Vocabulary, Conciseness";
      return await aiJson<ConversationFeedback>({
        name: "conversation_feedback",
        effort: "medium",
        system: `You are an expert ${data.kind === "interview" ? "interview" : data.kind === "gd" ? "group discussion" : "debate"} coach. Evaluate ONLY ${data.userName}'s contributions, honestly and specifically, quoting their words. Score each of these metrics 0-100: ${metricList}. For GD, comment on whether they dominated or stayed too quiet, interruptions, and building on others' points by name. strongest_point/weakest_point/best_response quote or paraphrase their actual words (for interviews: best answer / weakest answer / best moment).`,
        user: `Topic: "${data.topic}"${data.userSide ? `. ${data.userName} argued ${data.userSide}.` : ""}${data.interviewType ? ` Interview type: ${data.interviewType}.` : ""}\n${data.userName} contributed ${data.sharePct}% of words spoken.\nTranscript:\n${data.history.map((m) => `${m.speaker}: ${m.content}`).join("\n")}`,
        schema: S.obj({
          overall: SCORE,
          metrics: S.arr(S.obj({ label: S.str(), score: SCORE })),
          summary: S.str(),
          strongest_point: S.str(),
          weakest_point: S.str(),
          best_response: S.str(),
          observations: S.arr(S.str()),
          suggestions: S.arr(S.str()),
          rewrites: S.arr(S.obj({ original: S.str(), better: S.str() })),
          filler_words: S.arr(S.obj({ word: S.str(), count: S.int() })),
        }),
      });
    }),
  );

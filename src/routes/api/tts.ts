import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MAX_CHARS = 2000;

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

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await verify(request);
        if (!user) return json({ error: "Please sign in again." }, 401);
        let body: { text?: string; personality?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid request." }, 400);
        }
        const text = (body.text ?? "").trim();
        if (!text || text.length > MAX_CHARS) return json({ error: "Nothing to say." }, 400);
        const { hasAi, speakText } = await import("@/lib/ai/gateway.server");
        if (!hasAi()) return json({ error: "AI voice is not configured." }, 503);
        const upstream = await speakText(text, body.personality ?? "");
        if (!upstream.ok) {
          const errBody = await upstream.text();
          console.error("tts failed", upstream.status, errBody.slice(0, 400));
          const msg =
            upstream.status === 402
              ? "AI credits are used up."
              : upstream.status === 429
                ? "Too many requests. Please wait a moment."
                : "The AI voice is unavailable right now.";
          return json({ error: msg }, upstream.status);
        }
        return new Response(upstream.body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});

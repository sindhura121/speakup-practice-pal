import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Globe, Loader2, RefreshCw, Shuffle, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { generatePrompt } from "@/lib/ai/ai.functions";
import { DEBATE_PERSONALITIES, GD_PERSONALITIES } from "@/lib/ai/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ConversationArena, type AiParticipant } from "@/components/conversation";
import { DIFFICULTIES, DurationPicker, Field, Pills } from "@/components/options";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PType = "ai" | "friends" | "strangers" | "mixed";
const COUNTS = [2, 3, 4, 5, 6, 8, 10];

export function roomCode() {
  return `SPK-${Math.floor(10000 + Math.random() * 90000)}`;
}

export function GroupSetup({ kind }: { kind: "debate" | "gd" }) {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const gen = useServerFn(generatePrompt);
  const personalities = kind === "debate" ? DEBATE_PERSONALITIES : GD_PERSONALITIES;
  const [topic, setTopic] = useState("");
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [difficulty, setDifficulty] = useState(profile?.level ?? "intermediate");
  const [side, setSide] = useState<"for" | "against" | "random">("for");
  const [turnSec, setTurnSec] = useState(kind === "debate" ? 120 : 60);
  const [totalSec, setTotalSec] = useState(600);
  const [count, setCount] = useState(kind === "debate" ? 2 : 5);
  const [customCount, setCustomCount] = useState(false);
  const [ptype, setPtype] = useState<PType>("ai");
  const [humans, setHumans] = useState(2);
  const [seats, setSeats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [arena, setArena] = useState<{ ai: AiParticipant[]; side: string } | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const name = profile?.display_name ?? "You";

  const aiSeats = ptype === "ai" ? count - 1 : ptype === "mixed" ? Math.max(0, count - humans) : 0;

  useEffect(() => {
    setSeats((prev) => {
      const defaults = kind === "gd" ? ["moderator", "logical", "aggressive", "fact_based", "quiet", "balanced", "creative", "skeptic", "practical"] : personalities.map((p) => p.id);
      return Array.from({ length: aiSeats }, (_, i) => prev[i] ?? defaults[i % defaults.length]);
    });
  }, [aiSeats, kind, personalities]);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  const newTopic = async () => {
    setLoadingTopic(true);
    const r = await gen({ data: { mode: kind, difficulty, category: null } });
    setLoadingTopic(false);
    if (!r.ok) return toast.error(r.error);
    setTopic(r.data.prompt);
  };
  useEffect(() => {
    void newTopic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolvedSide = () => (side === "random" ? (Math.random() < 0.5 ? "for" : "against") : side);

  const buildAi = (userSide: string): AiParticipant[] => {
    const used = new Map<string, number>();
    return seats.map((pid, i) => {
      const p = personalities.find((x) => x.id === pid)!;
      const n = (used.get(pid) ?? 0) + 1;
      used.set(pid, n);
      const opp = userSide === "for" ? "against" : "for";
      return {
        name: n > 1 ? `${p.name} ${n}` : p.name,
        personality: p.id,
        label: p.label,
        side: kind === "debate" ? (i % 2 === 0 ? opp : userSide) : null,
      };
    });
  };

  const start = async () => {
    if (topic.trim().length < 8) return toast.error("Pick or write a topic first.");
    const s = resolvedSide();
    if (ptype === "ai") return setArena({ ai: buildAi(s), side: s });
    if (!user) return;
    if (ptype === "strangers") return void matchmake();
    setBusy(true);
    const code = roomCode();
    const ai = buildAi(s);
    const capacity = ptype === "friends" ? count : humans;
    const { data, error } = await supabase
      .from("rooms")
      .insert({ code, kind, topic: topic.trim(), capacity, ai_count: ai.length, ai_personalities: ai as never, duration_sec: turnSec })
      .select("id, code")
      .single();
    if (error || !data) {
      setBusy(false);
      return toast.error(error?.message ?? "Could not create room");
    }
    await supabase.from("room_participants").insert({ room_id: data.id, display_name: name, side: kind === "debate" ? s : null });
    navigate({ to: "/rooms/$code", params: { code: data.code } });
  };

  const matchmake = async () => {
    setMatching(true);
    const tick = async () => {
      const { data, error } = await supabase.rpc("find_match", { _kind: kind, _level: difficulty, _duration: turnSec, _topic: topic.trim(), _name: name });
      if (error) {
        toast.error(error.message);
        return cancelMatch();
      }
      if (data) {
        if (poll.current) clearInterval(poll.current);
        const { data: room } = await supabase.from("rooms").select("code").eq("id", data).single();
        if (room) navigate({ to: "/rooms/$code", params: { code: room.code } });
      }
    };
    await tick();
    poll.current = setInterval(() => void tick(), 3000);
  };
  const cancelMatch = async () => {
    if (poll.current) clearInterval(poll.current);
    setMatching(false);
    if (user) await supabase.from("match_queue").delete().eq("user_id", user.id);
  };

  if (arena)
    return (
      <ConversationArena
        kind={kind}
        topic={topic}
        userName={name}
        userSide={kind === "debate" ? arena.side : null}
        ai={arena.ai}
        turnSec={turnSec}
        totalSec={kind === "gd" ? totalSec : undefined}
        config={{ participants: count, type: "ai", personalities: arena.ai.map((a) => a.personality), difficulty }}
        onExit={() => setArena(null)}
      />
    );

  if (matching)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
        <div className="relative grid h-24 w-24 place-items-center">
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
          <Globe className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-8 text-2xl font-bold">Finding a speaking partner…</h2>
        <p className="mt-2 text-muted-foreground">
          Matching on level ({difficulty}), {kind === "debate" ? "debate" : "discussion"} format and similar turn length. Keep this page open.
        </p>
        <Button variant="outline" className="mt-8" onClick={() => void cancelMatch()}>
          Cancel
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-primary">{kind === "debate" ? "⚔️ Debate" : "👥 Group Discussion"}</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{kind === "debate" ? "Set up a debate" : "Set up a group discussion"}</h1>

      <div className="mt-8 space-y-8 rounded-3xl border bg-card p-6 sm:p-8">
        <Field label={kind === "debate" ? "Motion" : "Topic"} hint="Freshly generated and never a repeat of something you've practiced.">
          <div className="rounded-2xl bg-secondary p-4">
            {loadingTopic ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Generating…</div>
            ) : (
              <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} className="min-h-0 resize-none border-0 bg-transparent p-0 font-display text-xl font-bold shadow-none focus-visible:ring-0" rows={2} />
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => void newTopic()} disabled={loadingTopic}>
            <RefreshCw className="h-4 w-4" /> New topic
          </Button>
        </Field>

        <Field label="Difficulty">
          <Pills options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        </Field>

        {kind === "debate" && (
          <Field label="Your side">
            <Pills options={[{ value: "for", label: "👍 For" }, { value: "against", label: "👎 Against" }, { value: "random", label: "🎲 Random" }]} value={side} onChange={(v) => setSide(v as typeof side)} />
          </Field>
        )}

        <Field label={kind === "debate" ? "Speaking time per turn" : "Max time per contribution"}>
          <DurationPicker presets={[{ value: 60, label: "1 min" }, { value: 120, label: "2 min" }, { value: 180, label: "3 min" }, { value: 300, label: "5 min" }]} value={turnSec} onChange={setTurnSec} min={15} max={600} />
        </Field>
        {kind === "gd" && ptype === "ai" && (
          <Field label="Total discussion length">
            <DurationPicker presets={[{ value: 300, label: "5 min" }, { value: 600, label: "10 min" }, { value: 900, label: "15 min" }]} value={totalSec} onChange={setTotalSec} min={60} max={3600} />
          </Field>
        )}

        <Field label="Participants" hint="Including you.">
          <div className="flex flex-wrap items-center gap-2">
            <Pills
              options={[...COUNTS.map((c) => ({ value: String(c), label: String(c) })), { value: "custom", label: "Custom" }]}
              value={customCount ? "custom" : String(count)}
              onChange={(v) => {
                if (v === "custom") setCustomCount(true);
                else {
                  setCustomCount(false);
                  setCount(Number(v));
                }
              }}
            />
            {customCount && (
              <input type="number" min={2} max={12} value={count} onChange={(e) => setCount(Math.max(2, Math.min(12, Number(e.target.value) || 2)))} className="h-9 w-20 rounded-md border bg-background px-2" />
            )}
          </div>
        </Field>

        <Field label="Who joins?">
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { v: "ai", icon: Bot, t: "AI", d: "Practice instantly with AI personalities" },
              { v: "friends", icon: UserPlus, t: "Friends", d: "Private room with invite link & code" },
              { v: "strangers", icon: Globe, t: "Strangers", d: "Matched 1-on-1 by level and format" },
              { v: "mixed", icon: Users, t: "Mixed", d: "Friends plus AI in one room" },
            ] as const).map((o) => (
              <button key={o.v} onClick={() => setPtype(o.v)} className={cn("flex items-start gap-3 rounded-2xl border p-4 text-left transition", ptype === o.v ? "border-ink bg-secondary" : "hover:bg-secondary/60")}>
                <o.icon className="mt-0.5 h-5 w-5 text-primary" />
                <span>
                  <span className="block font-semibold">{o.t}</span>
                  <span className="text-sm text-muted-foreground">{o.d}</span>
                </span>
              </button>
            ))}
          </div>
          {ptype === "mixed" && (
            <div className="flex items-center gap-3 pt-2 text-sm">
              Humans (incl. you):
              <input type="number" min={2} max={count} value={humans} onChange={(e) => setHumans(Math.max(2, Math.min(count, Number(e.target.value) || 2)))} className="h-9 w-20 rounded-md border bg-background px-2" />
              <span className="text-muted-foreground">+ {aiSeats} AI</span>
            </div>
          )}
          {ptype === "strangers" && <p className="text-sm text-muted-foreground">Stranger matches are 1-on-1. You can report or block anyone, and leave at any time.</p>}
        </Field>

        {aiSeats > 0 && (
          <Field label="AI personalities">
            <div className="space-y-2">
              {seats.map((pid, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="w-14 text-xs font-semibold text-muted-foreground">Seat {i + 1}</span>
                  <select value={pid} onChange={(e) => setSeats((s) => s.map((x, j) => (j === i ? e.target.value : x)))} className="h-9 rounded-lg border bg-background px-2 text-sm">
                    {personalities.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">{personalities.find((p) => p.id === pid)?.desc}</span>
                </div>
              ))}
            </div>
          </Field>
        )}

        <Button size="lg" className="w-full" onClick={() => void start()} disabled={busy || loadingTopic}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
          {ptype === "ai" ? "Start now" : ptype === "strangers" ? "Find a match" : "Create room"}
        </Button>
      </div>
    </div>
  );
}

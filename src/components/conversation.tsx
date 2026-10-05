import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Flag, Loader2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { conversationTurn, evaluateConversation } from "@/lib/ai/ai.functions";
import type { ConvMessage } from "@/lib/ai/types";
import { supabase } from "@/integrations/supabase/client";
import { speak } from "@/lib/audio";
import { Avatar, fmtTime } from "@/components/brand";
import { TurnRecorder } from "@/components/turn-recorder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AiParticipant = { name: string; personality: string; label: string; side?: string | null };

export function MessageList({ messages, userName, personalityLabel }: { messages: (ConvMessage & { pending?: boolean })[]; userName: string; personalityLabel?: (p?: string) => string | undefined }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages.length]);
  return (
    <div className="space-y-5">
      {messages.map((m, i) => {
        const mine = m.isUser || m.speaker === userName;
        return (
          <div key={i} className={cn("flex gap-3", mine && "flex-row-reverse")}>
            <Avatar name={m.speaker} ai={!!m.personality} />
            <div className={cn("max-w-[80%]", mine && "text-right")}>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">
                {m.speaker}
                {m.personality && personalityLabel?.(m.personality) && <span className="font-normal"> · {personalityLabel(m.personality)}</span>}
              </div>
              <div className={cn("inline-block rounded-2xl px-4 py-3 text-left leading-relaxed", mine ? "bg-ink text-ink-foreground" : "bg-card ring-1 ring-border")}>{m.content}</div>
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function pickResponders(kind: string, ai: AiParticipant[], phase: "open" | "reply" | "close"): AiParticipant[] {
  if (kind === "interview") return ai.slice(0, 1);
  if (kind === "debate") {
    if (ai.length <= 2) return ai;
    return [...ai].sort(() => Math.random() - 0.5).slice(0, 2);
  }
  const mod = ai.find((a) => a.personality === "moderator");
  const others = ai.filter((a) => a.personality !== "moderator");
  if (phase === "open") return [...(mod ? [mod] : []), ...others.slice(0, 1)];
  if (phase === "close") return mod ? [mod] : others.slice(0, 1);
  const pool = others.filter((a) => a.personality !== "quiet" || Math.random() < 0.3);
  const n = Math.min(pool.length, 1 + Math.floor(Math.random() * Math.min(3, pool.length)));
  const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.max(1, n));
  if (mod && Math.random() < 0.25) chosen.push(mod);
  return chosen.length ? chosen : others.slice(0, 1);
}

/** Solo practice with AI participants: debate, group discussion or interview. */
export function ConversationArena(props: {
  kind: "debate" | "gd" | "interview";
  topic: string;
  userName: string;
  userSide?: string | null;
  interviewType?: string | null;
  ai: AiParticipant[];
  turnSec: number;
  totalSec?: number;
  config: Record<string, unknown>;
  onExit: () => void;
}) {
  const navigate = useNavigate();
  const turnFn = useServerFn(conversationTurn);
  const evalFn = useServerFn(evaluateConversation);
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [voice, setVoice] = useState(true);
  const [ending, setEnding] = useState(false);
  const [userSec, setUserSec] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const msgsRef = useRef<ConvMessage[]>([]);
  const started = useRef(false);
  const labelOf = (p?: string) => props.ai.find((a) => a.personality === p)?.label;

  const push = (m: ConvMessage[]) => {
    msgsRef.current = [...msgsRef.current, ...m];
    setMessages(msgsRef.current);
  };

  const aiTurn = async (phase: "open" | "reply" | "close") => {
    setThinking(true);
    const responders = pickResponders(props.kind, props.ai, phase);
    const r = await turnFn({
      data: { kind: props.kind, topic: props.topic, userName: props.userName, userSide: props.userSide, interviewType: props.interviewType, responders, history: msgsRef.current, phase },
    });
    setThinking(false);
    if (!r.ok) return toast.error(r.error);
    for (const m of r.data.messages) {
      push([m]);
      if (voice) await new Promise<void>((res) => speak(m.content, m.personality, res));
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void aiTurn("open");
    return () => window.speechSynthesis?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (props.totalSec && elapsed === props.totalSec && !ending) {
      toast("Time's up — wrapping up the discussion.");
      void end();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  const onTurn = async (text: string, sec: number) => {
    window.speechSynthesis?.cancel();
    setUserSec((s) => s + sec);
    push([{ speaker: props.userName, content: text, isUser: true }]);
    await aiTurn("reply");
  };

  const end = async () => {
    if (ending) return;
    const userMsgs = msgsRef.current.filter((m) => m.isUser);
    if (!userMsgs.length) {
      toast.error("Say at least one thing before ending so we can give feedback.");
      return;
    }
    setEnding(true);
    window.speechSynthesis?.cancel();
    if (props.kind === "gd") await aiTurn("close");
    const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
    const total = msgsRef.current.reduce((a, m) => a + words(m.content), 0);
    const mine = userMsgs.reduce((a, m) => a + words(m.content), 0);
    const sharePct = total ? Math.round((mine / total) * 100) : 0;
    const r = await evalFn({ data: { kind: props.kind, topic: props.topic, userName: props.userName, userSide: props.userSide, history: msgsRef.current, sharePct, interviewType: props.interviewType } });
    if (!r.ok) {
      setEnding(false);
      return toast.error(r.error);
    }
    const metricsObj = Object.fromEntries(r.data.metrics.map((m) => [m.label.toLowerCase(), m.score]));
    const { data, error } = await supabase
      .from("practice_sessions")
      .insert({
        mode: props.kind,
        prompt: props.topic,
        config: { ...props.config, sharePct, turns: userMsgs.length } as never,
        duration_sec: userSec,
        overall_score: r.data.overall,
        scores: metricsObj as never,
        feedback: { ...r.data, kind: "conversation", sharePct, messages: msgsRef.current } as never,
        transcript: msgsRef.current.map((m) => `${m.speaker}: ${m.content}`).join("\n"),
      })
      .select("id")
      .single();
    if (error) {
      setEnding(false);
      return toast.error(error.message);
    }
    navigate({ to: "/history/$id", params: { id: data.id } });
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-3xl flex-col lg:h-[calc(100vh-5rem)]">
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {props.kind === "debate" ? `Debate · you argue ${props.userSide}` : props.kind === "gd" ? "Group discussion" : props.interviewType}
          </div>
          <h2 className="mt-1 font-display text-lg font-bold leading-snug sm:text-xl">{props.topic}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-ink-foreground">{props.userName} (you)</span>
            {props.ai.map((a) => (
              <span key={a.name} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                {a.name} · {a.label}
                {a.side ? ` · ${a.side}` : ""}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="font-display text-xl font-bold tabular-nums">{props.totalSec ? fmtTime(props.totalSec - elapsed) : fmtTime(elapsed)}</span>
          <Button variant="ghost" size="icon" onClick={() => setVoice((v) => !v)} aria-label="Toggle AI voices">
            {voice ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-6">
        <MessageList messages={messages} userName={props.userName} personalityLabel={labelOf} />
        {thinking && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {props.kind === "interview" ? "Interviewer is thinking…" : "Others are responding…"}
          </div>
        )}
      </div>
      <div className="space-y-3 border-t pt-4">
        <TurnRecorder maxSec={props.turnSec} disabled={thinking || ending} onTurn={onTurn} label={props.kind === "interview" ? "Answer the question" : "Make your point"} />
        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={props.onExit} disabled={ending}>
            Leave
          </Button>
          <Button size="sm" variant="outline" onClick={() => void end()} disabled={ending}>
            {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />} End & get feedback
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Square, RotateCcw, SkipForward, Check, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fmtTime } from "@/components/brand";
import { analyzeSpeech } from "@/lib/ai/ai.functions";
import { buildMetrics, startRecording, transcribe, uploadRecording, type Recording } from "@/lib/audio";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Phase = "ready" | "prep" | "recording" | "review" | "processing";

export function PracticeRunner(props: {
  mode: "speaking" | "storytelling" | "picture";
  prompt: string;
  promptNode?: ReactNode;
  prepSec: number;
  speakSec: number;
  difficulty: string;
  imageUrl?: string | null;
  attemptOf?: string | null;
  config: Record<string, unknown>;
  onSkip?: () => void;
  onExit: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeSpeech);
  const [phase, setPhase] = useState<Phase>("ready");
  const [left, setLeft] = useState(props.prepSec);
  const [level, setLevel] = useState(0);
  const [rec, setRec] = useState<Recording | null>(null);
  const [status, setStatus] = useState("");
  const [liveText, setLiveText] = useState("");
  const recorder = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const startedAt = useRef(0);

  useEffect(() => () => recorder.current?.cancel(), []);

  // countdown ticker
  useEffect(() => {
    if (phase !== "prep" && phase !== "recording") return;
    const id = setInterval(() => {
      if (phase === "recording") {
        const remaining = props.speakSec - (Date.now() - startedAt.current) / 1000;
        setLeft(remaining);
        if (remaining <= 0) void stop();
      } else {
        setLeft((l) => {
          if (l <= 1) {
            void beginRecording();
            return 0;
          }
          return l - 1;
        });
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const beginRecording = async () => {
    try {
      recorder.current = await startRecording(setLevel);
      startedAt.current = Date.now();
      setLeft(props.speakSec);
      setPhase("recording");
    } catch {
      toast.error("Microphone access is needed. Please allow it in your browser and try again.");
      setPhase("ready");
    }
  };

  const start = () => {
    if (props.prepSec > 0) {
      setLeft(props.prepSec);
      setPhase("prep");
    } else void beginRecording();
  };

  const stop = async () => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    try {
      const result = await r.stop();
      setRec(result);
      setPhase("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recording failed");
      setPhase("ready");
    }
  };

  const redo = () => {
    if (rec) URL.revokeObjectURL(rec.url);
    setRec(null);
    setPhase("ready");
  };

  const finish = async () => {
    if (!rec || !user) return;
    setPhase("processing");
    try {
      setStatus("Transcribing your speech…");
      const [transcript, path] = await Promise.all([transcribe(rec.file, setLiveText), uploadRecording(user.id, rec.file)]);
      setStatus("Analysing fluency, grammar, vocabulary and delivery…");
      const metrics = buildMetrics(rec, transcript);
      const res = await analyze({
        data: { mode: props.mode, prompt: props.prompt, transcript, metrics, difficulty: props.difficulty, imageUrl: props.imageUrl ?? null, targetSec: props.speakSec },
      });
      if (!res.ok) throw new Error(res.error);
      const { data, error } = await supabase
        .from("practice_sessions")
        .insert({
          mode: props.mode,
          prompt: props.prompt,
          config: { ...props.config, prepSec: props.prepSec, speakSec: props.speakSec, difficulty: props.difficulty, imageUrl: props.imageUrl ?? null } as never,
          duration_sec: rec.durationSec,
          overall_score: res.data.overall,
          scores: res.data.scores as never,
          feedback: res.data as never,
          transcript,
          recording_path: path,
          attempt_of: props.attemptOf ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      navigate({ to: "/history/$id", params: { id: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
      setPhase("review");
    }
  };

  const pct = phase === "recording" ? 1 - left / props.speakSec : phase === "prep" ? 1 - left / props.prepSec : 0;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={props.onExit} disabled={phase === "processing"}>
          ← Exit
        </Button>
        {props.onSkip && phase === "ready" && (
          <Button variant="ghost" size="sm" onClick={props.onSkip}>
            <SkipForward className="h-4 w-4" /> Skip prompt
          </Button>
        )}
      </div>

      <div className="mt-6 rounded-3xl border bg-card p-6 sm:p-10">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your prompt</div>
        <div className="mt-3">{props.promptNode ?? <p className="font-display text-2xl font-bold leading-snug sm:text-3xl">"{props.prompt}"</p>}</div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10">
        {phase === "processing" ? (
          <div className="flex max-w-lg flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="font-semibold">{status}</p>
            {liveText && <p className="line-clamp-4 text-sm text-muted-foreground">{liveText}</p>}
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {phase === "prep" ? "Preparation" : phase === "recording" ? (
                  <span className="inline-flex items-center gap-2 text-destructive">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" /> Recording
                  </span>
                ) : phase === "review" ? "Recorded" : `${fmtTime(props.speakSec)} to speak${props.prepSec ? ` · ${props.prepSec}s prep` : ""}`}
              </div>
              <div className="mt-2 font-display text-7xl font-extrabold tabular-nums sm:text-8xl">
                {phase === "review" && rec ? fmtTime(rec.durationSec) : fmtTime(phase === "ready" ? props.speakSec : left)}
              </div>
              {phase === "recording" && <div className="mt-1 text-sm text-muted-foreground">remaining</div>}
            </div>

            <div className="relative grid h-36 w-36 place-items-center">
              {phase === "recording" && (
                <>
                  <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
                  <span className="absolute inset-0 rounded-full bg-primary/20" style={{ transform: `scale(${1 + level * 0.5})`, transition: "transform 120ms" }} />
                </>
              )}
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="47" fill="none" stroke="var(--color-muted)" strokeWidth="3" />
                <circle cx="50" cy="50" r="47" fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeDasharray={295} strokeDashoffset={295 - pct * 295} />
              </svg>
              {phase === "ready" && (
                <button onClick={start} aria-label="Start" className="relative grid h-28 w-28 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105">
                  <Mic className="h-10 w-10" />
                </button>
              )}
              {phase === "prep" && (
                <button onClick={() => void beginRecording()} className="relative grid h-28 w-28 place-items-center rounded-full bg-secondary text-sm font-semibold">
                  Start now
                </button>
              )}
              {phase === "recording" && (
                <button onClick={() => void stop()} aria-label="Stop" className="relative grid h-28 w-28 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg">
                  <Square className="h-9 w-9 fill-current" />
                </button>
              )}
              {phase === "review" && (
                <div className="relative grid h-28 w-28 place-items-center rounded-full bg-success text-primary-foreground">
                  <Check className="h-10 w-10" />
                </div>
              )}
            </div>

            {phase === "ready" && <p className="text-sm text-muted-foreground">Tap the mic to {props.prepSec ? "begin preparation" : "start speaking"}.</p>}
            {phase === "recording" && (
              <div className="flex h-8 items-end gap-1">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span key={i} className={cn("w-1.5 rounded-full bg-primary/70")} style={{ height: `${8 + Math.abs(Math.sin(i * 1.7 + Date.now() / 300)) * level * 32}px` }} />
                ))}
              </div>
            )}
            {phase === "review" && rec && (
              <div className="flex w-full max-w-md flex-col items-center gap-4">
                <audio controls src={rec.url} className="w-full">
                  <track kind="captions" />
                </audio>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={redo}>
                    <RotateCcw className="h-4 w-4" /> Record again
                  </Button>
                  <Button onClick={() => void finish()}>
                    <Play className="h-4 w-4" /> Finish & get feedback
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

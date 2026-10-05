import { useEffect, useRef, useState } from "react";
import { Keyboard, Loader2, Mic, Send, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtTime } from "@/components/brand";
import { startRecording, transcribe } from "@/lib/audio";

/** Records one spoken turn (auto-stops at maxSec), transcribes it and hands back text + seconds. */
export function TurnRecorder({ maxSec, disabled, onTurn, label = "Speak your turn" }: { maxSec: number; disabled?: boolean; onTurn: (text: string, seconds: number) => void | Promise<void>; label?: string }) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [left, setLeft] = useState(maxSec);
  const [level, setLevel] = useState(0);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const rec = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const t0 = useRef(0);

  useEffect(() => () => rec.current?.cancel(), []);
  useEffect(() => {
    if (state !== "rec") return;
    const id = setInterval(() => {
      const l = maxSec - (Date.now() - t0.current) / 1000;
      setLeft(l);
      if (l <= 0) void stop();
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const start = async () => {
    try {
      rec.current = await startRecording(setLevel);
      t0.current = Date.now();
      setLeft(maxSec);
      setState("rec");
    } catch {
      toast.error("Microphone access is needed to speak.");
    }
  };
  const stop = async () => {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    setState("busy");
    try {
      const out = await r.stop();
      const t = await transcribe(out.file);
      if (!t.trim()) throw new Error("We couldn't hear anything — try again.");
      await onTurn(t, out.durationSec);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
    setState("idle");
  };
  const sendTyped = async () => {
    if (!text.trim()) return;
    setState("busy");
    await onTurn(text.trim(), Math.round(text.split(/\s+/).length / 2.3));
    setText("");
    setState("idle");
  };

  if (typing)
    return (
      <div className="flex gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your response…" className="min-h-12" disabled={disabled || state === "busy"} />
        <div className="flex flex-col gap-2">
          <Button size="icon" onClick={() => void sendTyped()} disabled={disabled || state === "busy"} aria-label="Send">
            {state === "busy" ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setTyping(false)} aria-label="Use microphone">
            <Mic />
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex items-center gap-4">
      {state === "rec" ? (
        <button onClick={() => void stop()} className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground" aria-label="Stop">
          <span className="absolute inset-0 rounded-full bg-destructive/30" style={{ transform: `scale(${1 + level * 0.5})` }} />
          <Square className="relative h-6 w-6 fill-current" />
        </button>
      ) : (
        <button
          onClick={() => void start()}
          disabled={disabled || state === "busy"}
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow transition hover:scale-105 disabled:opacity-40"
          aria-label="Record"
        >
          {state === "busy" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{state === "rec" ? "Recording…" : state === "busy" ? "Transcribing…" : disabled ? "Wait for your turn" : label}</div>
        <div className="text-sm tabular-nums text-muted-foreground">{state === "rec" ? `${fmtTime(left)} left` : `Up to ${fmtTime(maxSec)} per turn`}</div>
      </div>
      <Button variant="ghost" size="icon" onClick={() => setTyping(true)} disabled={state !== "idle"} aria-label="Type instead">
        <Keyboard />
      </Button>
    </div>
  );
}

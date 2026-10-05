import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ConversationArena } from "@/components/conversation";
import { DurationPicker, Field } from "@/components/options";
import { INTERVIEW_TYPES } from "@/lib/ai/types";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/interview")({
  head: () => ({ meta: [{ title: "Interview Practice — SpeakUp" }, { name: "description", content: "Adaptive AI interviews with follow-up questions." }] }),
  component: InterviewPage,
});

function InterviewPage() {
  const { profile } = useAuth();
  const [type, setType] = useState<string>("hr");
  const [role, setRole] = useState("");
  const [turnSec, setTurnSec] = useState(120);
  const [started, setStarted] = useState(false);
  const t = INTERVIEW_TYPES.find((x) => x.id === type)!;

  if (started)
    return (
      <ConversationArena
        kind="interview"
        topic={role ? `${t.label} for a ${role} role` : t.label}
        interviewType={t.label}
        userName={profile?.display_name ?? "Candidate"}
        ai={[{ name: "Ms. Rao", personality: "interviewer", label: "Interviewer" }]}
        turnSec={turnSec}
        config={{ type, role }}
        onExit={() => setStarted(false)}
      />
    );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-primary">💼 Interview</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Practice a real interview</h1>
      <p className="mt-2 text-muted-foreground">The interviewer adapts every follow-up to what you just said.</p>
      <div className="mt-8 space-y-8 rounded-3xl border bg-card p-6 sm:p-8">
        <Field label="Interview type">
          <div className="grid gap-3 sm:grid-cols-2">
            {INTERVIEW_TYPES.map((x) => (
              <button key={x.id} onClick={() => setType(x.id)} className={cn("rounded-2xl border p-4 text-left", type === x.id ? "border-ink bg-secondary" : "hover:bg-secondary/60")}>
                <div className="font-semibold">{x.label}</div>
                <div className="text-sm text-muted-foreground">{x.desc}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Target role (optional)">
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Frontend developer, Marketing intern" />
        </Field>
        <Field label="Max answer length">
          <DurationPicker presets={[{ value: 60, label: "1 min" }, { value: 120, label: "2 min" }, { value: 180, label: "3 min" }]} value={turnSec} onChange={setTurnSec} min={20} max={600} />
        </Field>
        <Button size="lg" className="w-full" onClick={() => setStarted(true)}>
          Start interview
        </Button>
      </div>
    </div>
  );
}

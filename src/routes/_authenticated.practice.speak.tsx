import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Shuffle, Tag, PenLine } from "lucide-react";
import { toast } from "sonner";
import { generatePrompt } from "@/lib/ai/ai.functions";
import { CATEGORIES } from "@/lib/ai/types";
import { supabase } from "@/integrations/supabase/client";
import { PracticeRunner } from "@/components/practice-runner";
import { DIFFICULTIES, DurationPicker, Field, Pills, PREP_TIMES, SPEAK_DURATIONS } from "@/components/options";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";

type Search = { retry?: string; daily?: boolean };

export const Route = createFileRoute("/_authenticated/practice/speak")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    retry: typeof s.retry === "string" ? s.retry : undefined,
    daily: s.daily === true || s.daily === "true" ? true : undefined,
  }),
  head: () => ({ meta: [{ title: "Random Speaking — SpeakUp" }, { name: "description", content: "Speak on a fresh, unique prompt and get AI feedback." }] }),
  component: SpeakPage,
});

function SpeakPage() {
  const { retry, daily } = Route.useSearch();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const gen = useServerFn(generatePrompt);
  const [speakSec, setSpeakSec] = useState(daily ? 120 : 60);
  const [prepSec, setPrepSec] = useState(30);
  const [difficulty, setDifficulty] = useState(profile?.level ?? "intermediate");
  const [source, setSource] = useState<"random" | "category" | "custom">("random");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [custom, setCustom] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [attemptOf, setAttemptOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!retry) return;
    supabase
      .from("practice_sessions")
      .select("id, prompt, config, attempt_of")
      .eq("id", retry)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const c = data.config as Record<string, number | string>;
        setSpeakSec(Number(c.speakSec) || 60);
        setPrepSec(Number(c.prepSec) || 0);
        if (c.difficulty) setDifficulty(String(c.difficulty));
        setAttemptOf(data.attempt_of ?? data.id);
        setPrompt(data.prompt);
      });
  }, [retry]);

  const fetchPrompt = async () => {
    if (source === "custom") {
      if (custom.trim().length < 8) return toast.error("Write a full sentence or question for your prompt.");
      setPrompt(custom.trim());
      return;
    }
    setLoading(true);
    const res = await gen({ data: { mode: "speaking", category: source === "category" ? category : daily ? CATEGORIES[new Date().getDate() % CATEGORIES.length] : null, difficulty } });
    setLoading(false);
    if (!res.ok) return toast.error(res.error);
    setPrompt(res.data.prompt);
  };

  if (prompt)
    return (
      <PracticeRunner
        key={prompt}
        mode="speaking"
        prompt={prompt}
        prepSec={prepSec}
        speakSec={speakSec}
        difficulty={difficulty}
        attemptOf={attemptOf}
        config={{ source, category: source === "category" ? category : null, daily: !!daily }}
        onSkip={attemptOf || source === "custom" ? undefined : () => void fetchPrompt()}
        onExit={() => (retry ? navigate({ to: "/history/$id", params: { id: retry } }) : setPrompt(null))}
      />
    );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-primary">{daily ? "🎯 Today's challenge" : "🗣️ Random Speaking"}</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{daily ? "Speak for 2 minutes" : "Set up your speech"}</h1>
      <p className="mt-2 text-muted-foreground">Every prompt is generated fresh and checked against everything you've practiced before.</p>

      <div className="mt-8 space-y-8 rounded-3xl border bg-card p-6 sm:p-8">
        <Field label="Speaking duration">
          <DurationPicker presets={SPEAK_DURATIONS} value={speakSec} onChange={setSpeakSec} min={10} max={600} />
        </Field>
        <Field label="Preparation time">
          <DurationPicker presets={PREP_TIMES} value={prepSec} onChange={setPrepSec} max={300} />
        </Field>
        <Field label="Difficulty">
          <Pills options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        </Field>
        {!daily && (
          <Field label="Prompt">
            <Pills
              options={[
                { value: "random", label: "🎲 Random" },
                { value: "category", label: "🏷️ Category" },
                { value: "custom", label: "✍️ Custom" },
              ]}
              value={source}
              onChange={(v) => setSource(v as typeof source)}
            />
            {source === "category" && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${category === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {source === "custom" && <Textarea value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Should cities ban cars from their centres?" />}
          </Field>
        )}
        <Button size="lg" className="w-full" onClick={() => void fetchPrompt()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : source === "custom" ? <PenLine className="h-4 w-4" /> : source === "category" ? <Tag className="h-4 w-4" /> : <Shuffle className="h-4 w-4" />}
          {loading ? "Finding a fresh prompt…" : "Get my prompt"}
        </Button>
      </div>
    </div>
  );
}

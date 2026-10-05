import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateStoryElements } from "@/lib/ai/ai.functions";
import { PracticeRunner } from "@/components/practice-runner";
import { DIFFICULTIES, DurationPicker, Field, Pills, PREP_TIMES } from "@/components/options";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/practice/story")({
  head: () => ({ meta: [{ title: "Storytelling — SpeakUp" }, { name: "description", content: "Build a story from random words." }] }),
  component: StoryPage,
});

function StoryPage() {
  const navigate = useNavigate();
  const gen = useServerFn(generateStoryElements);
  const [speakSec, setSpeakSec] = useState(120);
  const [prepSec, setPrepSec] = useState(30);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [els, setEls] = useState<{ words: string[]; situation: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await gen({ data: { difficulty } });
    setLoading(false);
    if (!r.ok) return toast.error(r.error);
    setEls(r.data);
  };

  if (els) {
    const prompt = `Tell a story using the words: ${els.words.join(", ")}. Starter: ${els.situation}`;
    return (
      <PracticeRunner
        key={prompt}
        mode="storytelling"
        prompt={prompt}
        promptNode={
          <div>
            <div className="flex flex-wrap gap-3">
              {els.words.map((w) => (
                <span key={w} className="rounded-2xl bg-sun px-5 py-3 font-display text-2xl font-bold text-ink">
                  {w}
                </span>
              ))}
            </div>
            <p className="mt-5 text-lg text-muted-foreground">{els.situation}</p>
          </div>
        }
        prepSec={prepSec}
        speakSec={speakSec}
        difficulty={difficulty}
        config={{ words: els.words }}
        onSkip={() => void load()}
        onExit={() => setEls(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-primary">📖 Storytelling</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Spin a story from random words</h1>
      <div className="mt-8 space-y-8 rounded-3xl border bg-card p-6 sm:p-8">
        <Field label="Speaking duration">
          <DurationPicker presets={[{ value: 60, label: "1 min" }, { value: 120, label: "2 min" }, { value: 180, label: "3 min" }]} value={speakSec} onChange={setSpeakSec} min={20} max={600} />
        </Field>
        <Field label="Preparation time">
          <DurationPicker presets={PREP_TIMES} value={prepSec} onChange={setPrepSec} max={300} />
        </Field>
        <Field label="Difficulty">
          <Pills options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        </Field>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>Cancel</Button>
          <Button size="lg" className="flex-1" onClick={() => void load()} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Draw my words
          </Button>
        </div>
      </div>
    </div>
  );
}

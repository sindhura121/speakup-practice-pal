import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PracticeRunner } from "@/components/practice-runner";
import { DIFFICULTIES, DurationPicker, Field, Pills, PREP_TIMES, SPEAK_DURATIONS } from "@/components/options";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/practice/picture")({
  head: () => ({ meta: [{ title: "Picture Description — SpeakUp" }, { name: "description", content: "Describe a random photo against the clock." }] }),
  component: PicturePage,
});

const randomImage = () => `https://picsum.photos/id/${Math.floor(Math.random() * 1000)}/1200/800`;

function PicturePage() {
  const navigate = useNavigate();
  const [speakSec, setSpeakSec] = useState(60);
  const [prepSec, setPrepSec] = useState(15);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [img, setImg] = useState<string | null>(null);

  if (img)
    return (
      <PracticeRunner
        key={img}
        mode="picture"
        prompt="Describe what you see in this picture in as much detail as you can."
        promptNode={
          <div>
            <img src={img} alt="Picture to describe" className="aspect-[3/2] w-full rounded-2xl object-cover" onError={() => setImg(randomImage())} />
            <p className="mt-4 text-muted-foreground">Describe the scene, people, objects, mood and what might be happening.</p>
          </div>
        }
        prepSec={prepSec}
        speakSec={speakSec}
        difficulty={difficulty}
        imageUrl={img}
        config={{}}
        onSkip={() => setImg(randomImage())}
        onExit={() => setImg(null)}
      />
    );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-primary">🖼️ Picture Description</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Describe what you see</h1>
      <div className="mt-8 space-y-8 rounded-3xl border bg-card p-6 sm:p-8">
        <Field label="Speaking duration">
          <DurationPicker presets={SPEAK_DURATIONS.slice(0, 4)} value={speakSec} onChange={setSpeakSec} min={15} max={600} />
        </Field>
        <Field label="Preparation time">
          <DurationPicker presets={PREP_TIMES} value={prepSec} onChange={setPrepSec} max={300} />
        </Field>
        <Field label="Difficulty">
          <Pills options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        </Field>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>Cancel</Button>
          <Button size="lg" className="flex-1" onClick={() => setImg(randomImage())}>
            Show me a picture
          </Button>
        </div>
      </div>
    </div>
  );
}

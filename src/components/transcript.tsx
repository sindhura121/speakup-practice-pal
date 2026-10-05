import type { SpeechFeedback } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type Kind = "grammar" | "filler" | "repeat" | "vocab";
const STYLE: Record<Kind, string> = {
  grammar: "bg-destructive/15 underline decoration-destructive decoration-wavy underline-offset-4",
  filler: "bg-warning/30",
  repeat: "bg-chart-4/20",
  vocab: "bg-accent underline decoration-dotted underline-offset-4",
};
const LABEL: Record<Kind, string> = { grammar: "Grammar", filler: "Filler word", repeat: "Repeated word", vocab: "Vocabulary opportunity" };

export function HighlightedTranscript({ text, fb }: { text: string; fb: Partial<SpeechFeedback> }) {
  const lower = text.toLowerCase();
  const ranges: { s: number; e: number; k: Kind; tip: string }[] = [];
  const addAll = (needle: string, k: Kind, tip: string, word = true) => {
    if (!needle || needle.length < 2) return;
    const n = needle.toLowerCase();
    let i = 0;
    while ((i = lower.indexOf(n, i)) !== -1) {
      const before = lower[i - 1];
      const after = lower[i + n.length];
      const ok = !word || ((!before || !/[a-z]/.test(before)) && (!after || !/[a-z]/.test(after)));
      if (ok) ranges.push({ s: i, e: i + n.length, k, tip });
      i += n.length;
    }
  };
  fb.grammar_issues?.forEach((g) => addAll(g.text, "grammar", `${g.correction} — ${g.explanation}`, false));
  fb.filler_words?.forEach((f) => addAll(f.word, "filler", `Filler word (${f.count}×)`));
  fb.vocab_suggestions?.forEach((v) => addAll(v.word, "vocab", `Try: ${v.alternatives.join(", ")}`));
  fb.repeated_words?.forEach((r) => addAll(r.word, "repeat", `Repeated ${r.count}×`));
  ranges.sort((a, b) => a.s - b.s || b.e - a.e);
  const picked: typeof ranges = [];
  let end = -1;
  for (const r of ranges) if (r.s >= end) { picked.push(r); end = r.e; }

  const parts: React.ReactNode[] = [];
  let cur = 0;
  picked.forEach((r, i) => {
    if (r.s > cur) parts.push(text.slice(cur, r.s));
    parts.push(
      <mark key={i} title={r.tip} className={cn("rounded px-0.5 text-foreground", STYLE[r.k])}>
        {text.slice(r.s, r.e)}
      </mark>,
    );
    cur = r.e;
  });
  parts.push(text.slice(cur));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        {(Object.keys(STYLE) as Kind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn("inline-block h-3 w-5 rounded", STYLE[k])} /> {LABEL[k]}
          </span>
        ))}
        {fb.metrics && <span className="text-muted-foreground">· {fb.metrics.longPauses} long pauses (over 2s) detected in audio</span>}
      </div>
      <p className="whitespace-pre-wrap text-[17px] leading-8">{parts}</p>
      <p className="mt-3 text-xs text-muted-foreground">Hover a highlight to see the suggestion.</p>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, RotateCcw, ThumbsUp, AlertTriangle, Lightbulb, Trophy, Target, Swords } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { recordingUrl } from "@/lib/audio";
import { CORE_METRICS, type ConversationFeedback, type SpeechFeedback, type ConvMessage } from "@/lib/ai/types";
import { MODE_LABEL, type Session } from "@/lib/stats";
import { ScoreBar, ScoreRing, fmtTime } from "@/components/brand";
import { HighlightedTranscript } from "@/components/transcript";
import { MessageList } from "@/components/conversation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/history/$id")({
  head: () => ({ meta: [{ title: "Session feedback — SpeakUp" }, { name: "description", content: "Detailed AI feedback on your speaking session." }] }),
  component: SessionPage,
});

function Card({ title, icon, children, className }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border bg-card p-6 ${className ?? ""}`}>
      <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function SessionPage() {
  const { id } = Route.useParams();
  const [s, setS] = useState<Session | null>(null);
  const [attempts, setAttempts] = useState<Session[]>([]);
  const [audio, setAudio] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setS(null);
    (async () => {
      const { data } = await supabase.from("practice_sessions").select("*").eq("id", id).maybeSingle();
      if (!data) return setMissing(true);
      setS(data);
      const root = data.attempt_of ?? data.id;
      const { data: att } = await supabase.from("practice_sessions").select("*").or(`id.eq.${root},attempt_of.eq.${root}`).order("created_at");
      setAttempts(att ?? []);
      if (data.recording_path) setAudio(await recordingUrl(data.recording_path));
    })();
  }, [id]);

  if (missing) return <p className="py-24 text-center text-muted-foreground">Session not found.</p>;
  if (!s) return <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const isConv = (s.feedback as { kind?: string })?.kind === "conversation";
  const retryTo = s.mode === "speaking" ? { to: "/practice/speak" as const, search: { retry: s.id } } : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">{MODE_LABEL[s.mode] ?? s.mode} · {format(new Date(s.created_at), "d MMM yyyy, HH:mm")}</p>
          <h1 className="mt-1 max-w-3xl text-2xl font-bold sm:text-3xl">"{s.prompt}"</h1>
        </div>
        <div className="flex gap-2">
          {retryTo && (
            <Button asChild>
              <Link {...retryTo}>
                <RotateCcw className="h-4 w-4" /> Try this topic again
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
      {isConv ? <ConversationView s={s} /> : <SpeechView s={s} audio={audio} attempts={attempts} />}
    </div>
  );
}

function Comparison({ attempts, current }: { attempts: Session[]; current: Session }) {
  const idx = attempts.findIndex((a) => a.id === current.id);
  if (attempts.length < 2) return null;
  const prev = attempts[idx > 0 ? idx - 1 : 0];
  const cur = idx > 0 ? current : attempts[1];
  const p = prev.feedback as unknown as SpeechFeedback;
  const c = cur.feedback as unknown as SpeechFeedback;
  const delta = (cur.overall_score ?? 0) - (prev.overall_score ?? 0);
  const fillers = (f: SpeechFeedback) => f.filler_words?.reduce((a, x) => a + x.count, 0) ?? 0;
  const fp = fillers(p), fc = fillers(c);
  const fillerChange = fp ? Math.round(((fc - fp) / fp) * 100) : 0;
  return (
    <Card title="Attempt comparison" icon={<Trophy className="h-5 w-5 text-primary" />} className="bg-secondary">
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-xs font-semibold text-muted-foreground">Attempt {attempts.indexOf(prev) + 1}</div>
            <div className="font-display text-4xl font-extrabold">{prev.overall_score}</div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="text-center">
            <div className="text-xs font-semibold text-muted-foreground">Attempt {attempts.indexOf(cur) + 1}</div>
            <div className="font-display text-4xl font-extrabold">{cur.overall_score}</div>
          </div>
          <div className={`rounded-2xl px-3 py-2 font-display text-2xl font-extrabold ${delta >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {delta >= 0 ? "+" : ""}
            {delta}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {CORE_METRICS.map((m) => {
            const d = (c.scores?.[m] ?? 0) - (p.scores?.[m] ?? 0);
            return (
              <div key={m} className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
                <span className="capitalize">{m}</span>
                <span className={`font-bold ${d > 0 ? "text-success" : d < 0 ? "text-destructive" : "text-muted-foreground"}`}>{d > 0 ? "+" : ""}{d}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
            <span>Filler words</span>
            <span className={`font-bold ${fillerChange < 0 ? "text-success" : fillerChange > 0 ? "text-destructive" : "text-muted-foreground"}`}>{fillerChange > 0 ? "+" : ""}{fillerChange}%</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {attempts.map((a, i) => (
          <Link key={a.id} to="/history/$id" params={{ id: a.id }} className={`rounded-full border px-3 py-1 ${a.id === current.id ? "border-ink bg-ink text-ink-foreground" : "bg-card"}`}>
            Attempt {i + 1}: {a.overall_score}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function SpeechView({ s, audio, attempts }: { s: Session; audio: string | null; attempts: Session[] }) {
  const fb = s.feedback as unknown as SpeechFeedback;
  const idx = attempts.findIndex((a) => a.id === s.id);
  const prev = idx > 0 ? (attempts[idx - 1].feedback as unknown as SpeechFeedback) : null;
  return (
    <>
      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <section className="flex flex-col items-center justify-center rounded-3xl bg-ink p-8 text-ink-foreground">
          <ScoreRing value={fb.overall} size={170} stroke={14} label="Overall" />
          <p className="mt-5 text-center text-sm text-ink-foreground/80">{fb.summary}</p>
        </section>
        <section className="rounded-3xl border bg-card p-6">
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {CORE_METRICS.map((m) => (
              <ScoreBar key={m} label={m} value={fb.scores?.[m] ?? 0} delta={prev ? (fb.scores?.[m] ?? 0) - (prev.scores?.[m] ?? 0) : undefined} />
            ))}
            {fb.extra_scores?.map((x) => <ScoreBar key={x.label} label={x.label} value={x.score} />)}
          </div>
          {fb.metrics && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Duration", fmtTime(fb.metrics.durationSec)],
                ["Pace", `${fb.metrics.wpm} wpm`],
                ["Long pauses", String(fb.metrics.longPauses)],
                ["Words", String(fb.metrics.wordCount)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-muted p-3">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="font-display text-xl font-bold">{v}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Comparison attempts={attempts} current={s} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="What you did well" icon={<ThumbsUp className="h-5 w-5 text-success" />}>
          <ul className="space-y-2">{fb.strengths?.map((x, i) => <li key={i} className="flex gap-2"><span className="text-success">✓</span>{x}</li>)}</ul>
        </Card>
        <Card title="What to improve" icon={<AlertTriangle className="h-5 w-5 text-warning" />}>
          <ul className="space-y-2">{fb.improvements?.map((x, i) => <li key={i} className="flex gap-2"><span className="text-warning">•</span>{x}</li>)}</ul>
        </Card>
      </div>

      {!!fb.rewrites?.length && (
        <Card title="Better ways to say it" icon={<Lightbulb className="h-5 w-5 text-primary" />}>
          <div className="space-y-4">
            {fb.rewrites.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-muted p-4"><div className="mb-1 text-xs font-semibold text-muted-foreground">You said</div>"{r.original}"</div>
                <div className="rounded-2xl bg-success/10 p-4"><div className="mb-1 text-xs font-semibold text-success">Better</div>"{r.better}"</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Tabs defaultValue="transcript" className="rounded-3xl border bg-card p-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="fillers">Filler words</TabsTrigger>
          <TabsTrigger value="grammar">Grammar</TabsTrigger>
          <TabsTrigger value="vocab">Vocabulary</TabsTrigger>
          <TabsTrigger value="delivery">Delivery & content</TabsTrigger>
        </TabsList>
        <TabsContent value="transcript" className="pt-4">
          {audio && <audio controls src={audio} className="mb-5 w-full"><track kind="captions" /></audio>}
          <HighlightedTranscript text={s.transcript ?? ""} fb={fb} />
        </TabsContent>
        <TabsContent value="fillers" className="pt-4">
          {fb.filler_words?.length ? (
            <div className="flex flex-wrap gap-3">
              {fb.filler_words.map((f) => (
                <div key={f.word} className="rounded-2xl bg-warning/20 px-4 py-3">
                  <div className="font-display text-2xl font-bold">{f.count}×</div>
                  <div className="text-sm">"{f.word}"</div>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground">No filler words detected. Great control!</p>}
          {!!fb.repeated_words?.length && (
            <p className="mt-4 text-sm text-muted-foreground">Repeated words: {fb.repeated_words.map((r) => `${r.word} (${r.count}×)`).join(", ")}</p>
          )}
        </TabsContent>
        <TabsContent value="grammar" className="space-y-3 pt-4">
          {fb.grammar_issues?.length ? fb.grammar_issues.map((g, i) => (
            <div key={i} className="rounded-2xl border p-4">
              <div><span className="line-through decoration-destructive">{g.text}</span> → <b>{g.correction}</b></div>
              <div className="mt-1 text-sm text-muted-foreground">{g.explanation}</div>
            </div>
          )) : <p className="text-muted-foreground">No grammar issues found.</p>}
        </TabsContent>
        <TabsContent value="vocab" className="space-y-3 pt-4">
          {fb.vocab_suggestions?.map((v, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2"><b>{v.word}</b> → {v.alternatives.map((a) => <span key={a} className="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">{a}</span>)}</div>
          ))}
          {!fb.vocab_suggestions?.length && <p className="text-muted-foreground">No suggestions this time.</p>}
        </TabsContent>
        <TabsContent value="delivery" className="grid gap-4 pt-4 sm:grid-cols-2">
          {[
            ["Pace", fb.delivery?.pace], ["Tone", fb.delivery?.tone], ["Confidence", fb.delivery?.confidence],
            ["Relevance", fb.content_notes?.relevance], ["Organization", fb.content_notes?.organization], ["Examples", fb.content_notes?.examples],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-muted p-4"><div className="text-xs font-semibold text-muted-foreground">{k}</div><div className="mt-1">{v}</div></div>
          ))}
          {!!fb.pronunciation_notes?.length && (
            <div className="rounded-2xl bg-muted p-4 sm:col-span-2"><div className="text-xs font-semibold text-muted-foreground">Pronunciation</div><ul className="mt-1 list-disc pl-5">{fb.pronunciation_notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>
          )}
        </TabsContent>
      </Tabs>

      {fb.recommendation && (
        <section className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-sun p-6 text-ink sm:flex-row sm:items-center">
          <div className="flex gap-3"><Target className="mt-0.5 h-5 w-5 shrink-0" /><div><div className="font-bold">Next practice</div><div>{fb.recommendation}</div></div></div>
          {s.mode === "speaking" && <Button asChild variant="secondary"><Link to="/practice/speak" search={{ retry: s.id }}>Try again</Link></Button>}
        </section>
      )}
    </>
  );
}

function ConversationView({ s }: { s: Session }) {
  const fb = s.feedback as unknown as ConversationFeedback & { sharePct: number; messages: ConvMessage[] };
  const title = s.mode === "debate" ? "Debate score" : s.mode === "gd" ? "GD score" : "Interview score";
  const labels = s.mode === "interview" ? ["Best answer", "Weakest answer", "Best moment"] : s.mode === "debate" ? ["Strongest argument", "Weakest argument", "Best rebuttal"] : ["Strongest contribution", "Weakest contribution", "Best response"];
  return (
    <>
      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <section className="flex flex-col items-center justify-center rounded-3xl bg-ink p-8 text-ink-foreground">
          <ScoreRing value={fb.overall} size={170} stroke={14} label={title} />
          <p className="mt-4 text-sm text-ink-foreground/80">You contributed {fb.sharePct}% of the discussion.</p>
        </section>
        <section className="rounded-3xl border bg-card p-6">
          <p className="mb-5">{fb.summary}</p>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{fb.metrics?.map((m) => <ScoreBar key={m.label} label={m.label} value={m.score} />)}</div>
        </section>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Card title={labels[0]} icon={<Trophy className="h-5 w-5 text-success" />}><p>{fb.strongest_point}</p></Card>
        <Card title={labels[1]} icon={<AlertTriangle className="h-5 w-5 text-warning" />}><p>{fb.weakest_point}</p></Card>
        <Card title={labels[2]} icon={<Swords className="h-5 w-5 text-primary" />}><p>{fb.best_response}</p></Card>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Observations"><ul className="list-disc space-y-2 pl-5">{fb.observations?.map((o, i) => <li key={i}>{o}</li>)}</ul></Card>
        <Card title="Improvement suggestions" icon={<Lightbulb className="h-5 w-5 text-primary" />}><ul className="list-disc space-y-2 pl-5">{fb.suggestions?.map((o, i) => <li key={i}>{o}</li>)}</ul></Card>
      </div>
      {!!fb.rewrites?.length && (
        <Card title="Better ways to say it">
          <div className="space-y-4">
            {fb.rewrites.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-muted p-4">"{r.original}"</div>
                <div className="rounded-2xl bg-success/10 p-4">"{r.better}"</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card title="Full transcript">
        <MessageList messages={fb.messages ?? []} userName="" />
      </Card>
    </>
  );
}

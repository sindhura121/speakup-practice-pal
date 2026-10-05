import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { BADGES, computeStats, fetchSessions, recommendation } from "@/lib/stats";
import { fmtTime, ScoreBar, ScoreRing } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progress — SpeakUp" }, { name: "description", content: "Your communication analytics, mistakes and achievements." }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const { data } = useQuery({ queryKey: ["sessions"], queryFn: fetchSessions });
  const { data: earned } = useQuery({ queryKey: ["achievements"], queryFn: async () => (await supabase.from("achievements").select("badge, earned_at")).data ?? [] });
  const st = computeStats(data ?? []);
  const rec = recommendation(st);
  const earnedSet = new Set((earned ?? []).map((e) => e.badge));
  const radar = Object.entries(st.metricAvg).map(([k, v]) => ({ k: k[0].toUpperCase() + k.slice(1), v }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-3xl font-bold">Progress</h1>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-ink p-6 text-ink-foreground">
          <ScoreRing value={st.overall} size={160} stroke={13} label="Overall" />
          <div className="mt-4 text-sm text-ink-foreground/70">Level {st.level} · {st.xp} XP</div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Total sessions", st.total], ["Speaking time", fmtTime(st.seconds)], ["Longest speech", fmtTime(st.longest)],
            ["Current streak", `${st.streak} 🔥`], ["Average score", st.avg], ["Best score", st.best],
            ["Debates", st.byMode.debate ?? 0], ["GDs", st.byMode.gd ?? 0], ["Interviews", st.byMode.interview ?? 0], ["Avg pace", st.avgWpm ? `${st.avgWpm} wpm` : "–"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="mt-1 font-display text-2xl font-extrabold">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border bg-card p-6">
          <h2 className="text-lg font-bold">Skills</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(st.metricAvg).map(([k, v]) => <ScoreBar key={k} label={k} value={v} />)}
            <ScoreBar label="Debate ability" value={st.debateAvg} />
            <ScoreBar label="GD performance" value={st.gdAvg} />
          </div>
        </div>
        <div className="rounded-3xl border bg-card p-6">
          <h2 className="text-lg font-bold">Skill shape</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={radar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="k" fontSize={12} />
                <Radar dataKey="v" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border bg-card p-6">
        <h2 className="text-lg font-bold">Weekly average score</h2>
        {st.weekly.length ? (
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <LineChart data={st.weekly}>
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={30} />
                <Tooltip />
                <Line dataKey="score" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="mt-4 text-muted-foreground">No scored sessions yet.</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border bg-card p-6">
          <h2 className="text-lg font-bold">Most-used filler words</h2>
          {st.topFillers.length ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer>
                <BarChart data={st.topFillers.map(([w, c]) => ({ w: `"${w}"`, c }))} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="w" width={90} tickLine={false} axisLine={false} fontSize={13} />
                  <Tooltip />
                  <Bar dataKey="c" fill="var(--color-warning)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="mt-4 text-muted-foreground">None tracked yet.</p>}
        </div>
        <div className="rounded-3xl border bg-card p-6">
          <h2 className="text-lg font-bold">Recurring mistakes</h2>
          <div className="mt-4 space-y-4 text-sm">
            <div><div className="font-semibold">Grammar patterns</div>{st.grammar.length ? <ul className="mt-1 list-disc pl-5 text-muted-foreground">{st.grammar.map((g) => <li key={g}>{g}</li>)}</ul> : <p className="text-muted-foreground">None yet.</p>}</div>
            <div><div className="font-semibold">Frequently repeated words</div><p className="text-muted-foreground">{st.topRepeated.map(([w, c]) => `${w} (${c}×)`).join(", ") || "None yet."}</p></div>
            <div><div className="font-semibold">Pace & pauses</div><p className="text-muted-foreground">Average {st.avgWpm || "–"} wpm (ideal 130–160) · {st.pauses} long pauses in total</p></div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-sun p-6 text-ink sm:flex-row sm:items-center">
        <div><div className="text-sm">Your biggest current weakness: <b>{rec.weakness}</b></div><div className="mt-1 text-lg font-semibold">{rec.text}</div></div>
        <Button asChild variant="secondary"><Link to={rec.to}>Practice now</Link></Button>
      </div>

      <div className="rounded-3xl border bg-card p-6">
        <h2 className="text-lg font-bold">Badges</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {BADGES.map((b) => {
            const has = earnedSet.has(b.id) || b.test(st);
            return (
              <div key={b.id} className={`rounded-2xl border p-4 text-center ${has ? "bg-secondary" : "opacity-40 grayscale"}`}>
                <div className="text-3xl">{b.emoji}</div>
                <div className="mt-2 text-xs font-semibold">{b.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

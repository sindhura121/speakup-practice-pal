import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Clock, Flame, Mic, Target, Zap } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { computeStats, fetchSessions, MODE_LABEL, recommendation, syncBadges } from "@/lib/stats";
import { ScoreRing } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SpeakUp" }, { name: "description", content: "Your speaking streak, scores and recommended practice." }] }),
  component: Dashboard,
});

const MODES = [
  { to: "/practice/speak", emoji: "🗣️", title: "Random Speaking", desc: "Speak on a unique prompt", tone: "bg-primary text-primary-foreground" },
  { to: "/debate", emoji: "⚔️", title: "Debate", desc: "AI, friends or strangers", tone: "bg-ink text-ink-foreground" },
  { to: "/gd", emoji: "👥", title: "Group Discussion", desc: "Realistic GD with personalities", tone: "bg-chart-2 text-primary-foreground" },
  { to: "/interview", emoji: "💼", title: "Interview", desc: "HR, behavioral, technical", tone: "bg-card" },
  { to: "/practice/story", emoji: "📖", title: "Storytelling", desc: "Story from random words", tone: "bg-sun text-ink" },
  { to: "/practice/picture", emoji: "🖼️", title: "Picture Description", desc: "Describe what you see", tone: "bg-accent text-accent-foreground" },
] as const;

function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const { data } = useQuery({ queryKey: ["sessions"], queryFn: fetchSessions });
  const sessions = data ?? [];
  const st = computeStats(sessions);
  const rec = recommendation(st);
  const today = new Date().toISOString().slice(0, 10);
  const dailyDone = sessions.some((s) => (s.config as { daily?: boolean })?.daily && s.created_at.slice(0, 10) === today);

  useEffect(() => {
    if (data) void syncBadges(st);
    const next = sessionStorage.getItem("speakup_next");
    if (next) {
      sessionStorage.removeItem("speakup_next");
      if (next.startsWith("/") && !next.startsWith("//")) window.location.assign(next);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d MMMM")}</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Hey {profile?.display_name ?? "there"} 👋</h1>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (c) navigate({ to: "/rooms/$code", params: { code: c.startsWith("SPK-") ? c : `SPK-${c}` } });
          }}
          className="flex gap-2"
        >
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Room code e.g. SPK-73921" className="w-52" />
          <Button variant="outline">Join</Button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-3xl bg-ink p-5 text-ink-foreground sm:col-span-2 lg:col-span-1">
          <ScoreRing value={st.overall} size={88} stroke={8} />
          <div>
            <div className="text-sm text-ink-foreground/70">Communication score</div>
            <div className="text-sm">Level {st.level} · {st.xp} XP</div>
            <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-ink-foreground/20"><div className="h-full bg-primary" style={{ width: `${(st.xpInLevel / 300) * 100}%` }} /></div>
          </div>
        </div>
        {[
          { icon: Flame, label: "Day streak", value: st.streak, tone: "text-primary" },
          { icon: Mic, label: "Sessions", value: st.total, tone: "text-chart-2" },
          { icon: Clock, label: "Minutes spoken", value: st.minutes, tone: "text-chart-4" },
        ].map((x) => (
          <div key={x.label} className="rounded-3xl border bg-card p-5">
            <x.icon className={`h-5 w-5 ${x.tone}`} />
            <div className="mt-3 font-display text-4xl font-extrabold">{x.value}</div>
            <div className="text-sm text-muted-foreground">{x.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border-2 border-dashed border-primary/40 bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Target className="h-4 w-4" /> Today's challenge</div>
          <h2 className="mt-2 text-2xl font-bold">🎯 Speak for 2 minutes on a fresh prompt</h2>
          <p className="mt-1 text-muted-foreground">{dailyDone ? "Done for today — 🔥 streak secured!" : "Complete it to keep your streak alive."}</p>
          <Button asChild className="mt-4" variant={dailyDone ? "outline" : "default"}>
            <Link to="/practice/speak" search={{ daily: true }}>{dailyDone ? "Do it again" : "Start challenge"} <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="rounded-3xl bg-sun p-6 text-ink">
          <div className="flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4" /> Recommended for you</div>
          <div className="mt-2 text-sm">Biggest current focus: <b>{rec.weakness}</b></div>
          <p className="mt-1 text-lg font-semibold">{rec.text}</p>
          <Button asChild variant="secondary" className="mt-4"><Link to={rec.to}>Practice now</Link></Button>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-bold">Practice modes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => (
            <Link key={m.to} to={m.to} className={`group relative overflow-hidden rounded-3xl border p-6 transition hover:-translate-y-0.5 hover:shadow-lg ${m.tone}`}>
              <div className="text-4xl">{m.emoji}</div>
              <div className="mt-6 font-display text-xl font-bold">{m.title}</div>
              <div className="text-sm opacity-80">{m.desc}</div>
              <ArrowRight className="absolute right-6 top-6 h-5 w-5 opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border bg-card p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Improvement</h2><Link to="/progress" className="text-sm text-primary">Full progress →</Link></div>
          {st.trend.length > 1 ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer>
                <AreaChart data={st.trend}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="n" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} width={30} />
                  <Tooltip />
                  <Area dataKey="score" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="mt-6 text-muted-foreground">Complete two sessions to see your trend.</p>}
        </div>
        <div className="rounded-3xl border bg-card p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Recent</h2><Link to="/history" className="text-sm text-primary">All →</Link></div>
          <div className="mt-4 space-y-3">
            {sessions.slice(0, 5).map((s) => (
              <Link key={s.id} to="/history/$id" params={{ id: s.id }} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-secondary">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary font-bold">{s.overall_score ?? "–"}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{s.prompt}</span><span className="text-xs text-muted-foreground">{MODE_LABEL[s.mode]}</span></span>
              </Link>
            ))}
            {!sessions.length && <p className="text-sm text-muted-foreground">Your sessions will appear here.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

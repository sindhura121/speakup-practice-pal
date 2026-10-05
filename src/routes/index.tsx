import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Briefcase, Mic, Sparkle, Swords, Users, Wand2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Logo, ScoreRing } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SpeakUp — Speak better. Think faster. Communicate with confidence." },
      { name: "description", content: "Practice speaking, debates, group discussions and interviews with AI, friends or people worldwide — with detailed feedback on every attempt." },
      { property: "og:title", content: "SpeakUp — AI communication practice" },
      { property: "og:description", content: "Unique prompts, real-time debates and GDs, and detailed AI feedback on fluency, grammar, vocabulary and delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { id: "speaking", icon: Mic, title: "Speaking practice", text: "Pick a duration and prep time, get a prompt you've never seen, and speak. Prompts are checked against your history so ideas never repeat." },
  { id: "feedback", icon: Wand2, title: "AI feedback", text: "Seven scores, filler-word counts, long-pause detection from your audio, grammar fixes, vocabulary upgrades and 'better ways to say it'." },
  { id: "debate", icon: Swords, title: "Debate", text: "Argue for or against against AI opponents that actually push back — logical, aggressive, devil's advocate — or debate friends and strangers live." },
  { id: "gd", icon: Users, title: "Group discussions", text: "A moderator, a quiet thinker, a fact-checker and a provocateur. Up to 10 participants, mixing AI, friends and strangers." },
  { id: "interview", icon: Briefcase, title: "Interview practice", text: "HR, behavioral, technical and placement interviews where every follow-up is based on your last answer." },
  { id: "progress", icon: BarChart3, title: "Progress tracking", text: "Streaks, XP, badges, weekly trends and your personal mistake tracker — with practice recommended for your biggest weakness." },
];

function Landing() {
  const { user } = useAuth();
  const startTo = user ? "/dashboard" : "/auth";
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild><Link to="/dashboard">Dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link to="/auth">Log in</Link></Button>
              <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Sign up</Link></Button>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-medium">
            <Sparkle className="h-3.5 w-3.5 text-primary" /> For students and job seekers
          </span>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">
            Speak better. <span className="text-primary">Think faster.</span> Communicate with confidence.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Practice speaking, debates, group discussions, interviews, and more with AI, friends, or people from around the world.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link to={startTo}>Start Practicing <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <a href="#features">Explore Features</a>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[2rem] bg-ink p-7 text-ink-foreground shadow-2xl">
            <div className="text-xs font-semibold uppercase tracking-widest text-ink-foreground/60">Your prompt</div>
            <p className="mt-2 font-display text-2xl font-bold leading-snug">"People should have the right to disconnect from work after office hours."</p>
            <div className="mt-8 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Recording</div>
                <div className="font-display text-5xl font-extrabold tabular-nums">01:42</div>
              </div>
              <div className="flex h-14 items-end gap-1">
                {[20, 42, 30, 52, 26, 46, 34, 56, 22, 40, 30].map((h, i) => <span key={i} className="w-1.5 rounded-full bg-primary" style={{ height: h }} />)}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -left-4 flex items-center gap-4 rounded-3xl border bg-card p-4 shadow-xl sm:-left-10">
            <ScoreRing value={82} size={76} stroke={8} />
            <div className="text-sm">
              <div className="font-bold">Attempt 2: +14</div>
              <div className="text-muted-foreground">Fluency +12 · Fillers −40%</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-card py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-3xl font-bold sm:text-4xl">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              ["Choose", "Pick a mode, duration and prep time."],
              ["Prepare", "Get a truly unique prompt and gather your thoughts."],
              ["Speak", "Record with your mic — it stops automatically at zero."],
              ["Improve", "Read detailed feedback, retry, and compare attempts."],
            ].map(([t, d], i) => (
              <div key={t}>
                <div className="font-display text-5xl font-extrabold text-primary">0{i + 1}</div>
                <div className="mt-3 text-lg font-bold">{t}</div>
                <p className="mt-1 text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-bold sm:text-4xl">Everything you need to find your voice</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.id} className={`rounded-3xl border p-7 ${i === 1 ? "bg-sun text-ink" : i === 2 ? "bg-ink text-ink-foreground" : "bg-card"}`}>
              <f.icon className={`h-7 w-7 ${i === 1 || i === 2 ? "" : "text-primary"}`} />
              <h3 className="mt-5 text-xl font-bold">{f.title}</h3>
              <p className="mt-2 opacity-80">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-primary p-10 text-primary-foreground sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl font-bold">Your first speech takes 60 seconds.</h2>
            <p className="mt-2 opacity-90">Free to start. Your recordings stay private.</p>
          </div>
          <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base">
            <Link to={startTo}>Start Practicing</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} SpeakUp</footer>
    </div>
  );
}

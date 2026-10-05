import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CORE_METRICS } from "@/lib/ai/types";

export type Session = Tables<"practice_sessions">;

export const MODE_LABEL: Record<string, string> = {
  speaking: "Random Speaking",
  debate: "Debate",
  gd: "Group Discussion",
  interview: "Interview",
  storytelling: "Storytelling",
  picture: "Picture Description",
};

export const BADGES = [
  { id: "first_speech", emoji: "🎤", label: "First Speech", test: (s: Stats) => s.total >= 1 },
  { id: "streak_7", emoji: "🔥", label: "7-Day Streak", test: (s: Stats) => s.bestStreak >= 7 },
  { id: "sessions_50", emoji: "🏆", label: "50 Sessions", test: (s: Stats) => s.total >= 50 },
  { id: "minutes_100", emoji: "🗣️", label: "100 Minutes Spoken", test: (s: Stats) => s.minutes >= 100 },
  { id: "debates_10", emoji: "⚔️", label: "10 Debates", test: (s: Stats) => (s.byMode.debate ?? 0) >= 10 },
  { id: "gd_10", emoji: "👥", label: "10 Group Discussions", test: (s: Stats) => (s.byMode.gd ?? 0) >= 10 },
  { id: "score_80", emoji: "🌟", label: "80+ Overall Score", test: (s: Stats) => s.best >= 80 },
] as const;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function computeStats(sessions: Session[]) {
  const scored = sessions.filter((s) => s.overall_score != null);
  const total = sessions.length;
  const seconds = sessions.reduce((a, s) => a + (s.duration_sec ?? 0), 0);
  const avg = scored.length ? Math.round(scored.reduce((a, s) => a + (s.overall_score ?? 0), 0) / scored.length) : 0;
  const best = scored.reduce((a, s) => Math.max(a, s.overall_score ?? 0), 0);
  const recent = scored.slice(0, 10);
  const overall = recent.length ? Math.round(recent.reduce((a, s) => a + (s.overall_score ?? 0), 0) / recent.length) : 0;
  const byMode: Record<string, number> = {};
  sessions.forEach((s) => (byMode[s.mode] = (byMode[s.mode] ?? 0) + 1));

  // streaks
  const days = new Set(sessions.map((s) => dayKey(new Date(s.created_at))));
  let streak = 0;
  const cur = new Date();
  if (!days.has(dayKey(cur))) cur.setUTCDate(cur.getUTCDate() - 1);
  while (days.has(dayKey(cur))) {
    streak++;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  const sortedDays = [...days].sort();
  let bestStreak = 0, run = 0, prev: string | null = null;
  for (const d of sortedDays) {
    if (prev) {
      const p = new Date(prev);
      p.setUTCDate(p.getUTCDate() + 1);
      run = dayKey(p) === d ? run + 1 : 1;
    } else run = 1;
    bestStreak = Math.max(bestStreak, run);
    prev = d;
  }

  // per-metric averages (recent 10)
  const metricAvg: Record<string, number> = {};
  for (const m of CORE_METRICS) {
    const vals = recent.map((s) => (s.scores as Record<string, number>)?.[m]).filter((v): v is number => typeof v === "number");
    metricAvg[m] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }
  const modeAvg = (mode: string) => {
    const v = scored.filter((s) => s.mode === mode);
    return v.length ? Math.round(v.reduce((a, s) => a + (s.overall_score ?? 0), 0) / v.length) : 0;
  };

  // weekly trend
  const weeks = new Map<string, number[]>();
  [...scored].reverse().forEach((s) => {
    const d = new Date(s.created_at);
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const k = dayKey(monday);
    weeks.set(k, [...(weeks.get(k) ?? []), s.overall_score ?? 0]);
  });
  const weekly = [...weeks.entries()].map(([week, v], i) => ({ week: `W${i + 1}`, date: week, score: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }));
  const trend = [...scored].reverse().slice(-20).map((s, i) => ({ n: i + 1, score: s.overall_score ?? 0, date: s.created_at }));

  // mistakes
  const fillers = new Map<string, number>();
  const repeated = new Map<string, number>();
  const grammar: string[] = [];
  let wpmSum = 0, wpmN = 0, pauses = 0;
  sessions.forEach((s) => {
    const fb = s.feedback as Record<string, unknown>;
    (fb?.filler_words as { word: string; count: number }[] | undefined)?.forEach((f) => fillers.set(f.word.toLowerCase(), (fillers.get(f.word.toLowerCase()) ?? 0) + f.count));
    (fb?.repeated_words as { word: string; count: number }[] | undefined)?.forEach((f) => repeated.set(f.word.toLowerCase(), (repeated.get(f.word.toLowerCase()) ?? 0) + f.count));
    (fb?.grammar_issues as { explanation: string }[] | undefined)?.slice(0, 3).forEach((g) => grammar.push(g.explanation));
    const m = fb?.metrics as { wpm?: number; longPauses?: number } | undefined;
    if (m?.wpm) { wpmSum += m.wpm; wpmN++; }
    pauses += m?.longPauses ?? 0;
  });
  const topFillers = [...fillers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topRepeated = [...repeated.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const longest = sessions.reduce((a, s) => Math.max(a, s.duration_sec ?? 0), 0);
  const xp = sessions.reduce((a, s) => a + Math.round((s.overall_score ?? 40) / 2) + Math.round((s.duration_sec ?? 0) / 30), 0);

  const stats = {
    total, seconds, minutes: Math.round(seconds / 60), avg, best, overall, byMode, streak, bestStreak, metricAvg,
    debateAvg: modeAvg("debate"), gdAvg: modeAvg("gd"), interviewAvg: modeAvg("interview"),
    weekly, trend, topFillers, topRepeated, grammar: [...new Set(grammar)].slice(0, 6),
    avgWpm: wpmN ? Math.round(wpmSum / wpmN) : 0, pauses, longest, xp, level: Math.floor(xp / 300) + 1, xpInLevel: xp % 300,
  };
  return stats;
}
export type Stats = ReturnType<typeof computeStats>;

export function recommendation(s: Stats) {
  if (!s.total) return { weakness: "Getting started", text: "Do a 1-minute Random Speaking session to set your baseline.", to: "/practice/speak" as const };
  const fillerTotal = s.topFillers.reduce((a, [, c]) => a + c, 0);
  if (fillerTotal >= Math.max(5, s.total * 3)) {
    const words = s.topFillers.slice(0, 3).map(([w]) => `'${w}'`).join(", ");
    return { weakness: "Filler words", text: `Try a 2-minute speech without using ${words}.`, to: "/practice/speak" as const };
  }
  const entries = Object.entries(s.metricAvg).filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1]);
  const [weak] = entries[0] ?? ["fluency"];
  const map: Record<string, { text: string; to: "/practice/speak" | "/practice/story" | "/debate" | "/interview" | "/practice/picture" }> = {
    fluency: { text: "Do a 3-minute speech with only 15s prep — aim for zero pauses over 2 seconds.", to: "/practice/speak" },
    grammar: { text: "Describe a picture in full sentences, focusing on correct tenses and articles.", to: "/practice/picture" },
    vocabulary: { text: "Tell a 2-minute story using three random words and avoid repeating adjectives.", to: "/practice/story" },
    pronunciation: { text: "Speak slowly for 1 minute on a beginner prompt, stressing each key word clearly.", to: "/practice/speak" },
    clarity: { text: "Answer one behavioural interview question using the STAR structure.", to: "/interview" },
    confidence: { text: "Debate an aggressive AI opponent for 2 minutes and hold your position.", to: "/debate" },
    content: { text: "Give a 2-minute speech with one claim, two reasons and one concrete example.", to: "/practice/speak" },
  };
  return { weakness: weak.charAt(0).toUpperCase() + weak.slice(1), ...map[weak] };
}

export async function fetchSessions() {
  const { data, error } = await supabase.from("practice_sessions").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function syncBadges(stats: Stats) {
  const earned = BADGES.filter((b) => b.test(stats)).map((b) => ({ badge: b.id }));
  if (earned.length) await supabase.from("achievements").upsert(earned, { onConflict: "user_id,badge", ignoreDuplicates: true });
}

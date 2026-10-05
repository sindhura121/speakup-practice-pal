// Development fallback used only when LOVABLE_API_KEY is not configured.
// Keeps the app usable without AI; production logic lives in gateway.server.ts.
import type { ConvMessage, ConversationFeedback, SpeechFeedback, AudioMetrics } from "./types";

const SUBJECTS = [
  "Students", "Remote workers", "Cities", "Governments", "Parents", "Tech companies", "Teenagers",
  "Universities", "Artists", "Small businesses", "Hospitals", "Athletes", "Libraries", "Farmers",
  "Retirees", "Influencers", "Museums", "Airlines", "Restaurants", "Scientists",
];
const CLAIMS = [
  "should be required to publish their decisions openly",
  "would benefit more from fewer rules than from more support",
  "should prioritise long-term thinking over quick wins",
  "are underestimated by the people who depend on them",
  "should spend less time online and more time in their communities",
  "ought to be judged by outcomes rather than intentions",
  "should experiment with a four-day week",
  "deserve more public funding than they currently receive",
  "should be allowed to fail without being rescued",
  "will look completely different in twenty years",
];
const QUESTIONS = [
  "What is a skill nobody taught you that you wish someone had?",
  "Describe a time a small decision changed your week.",
  "Is it better to be a specialist or a generalist in your career?",
  "What would you change about the way your city handles public transport?",
  "Should success be measured by happiness or achievement?",
];

export function mockPrompt(avoid: string[]): { prompt: string; core_idea: string } {
  for (let i = 0; i < 40; i++) {
    const useQ = Math.random() < 0.2;
    const prompt = useQ
      ? QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]
      : `${SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)]} ${CLAIMS[Math.floor(Math.random() * CLAIMS.length)]}.`;
    if (!avoid.includes(prompt)) return { prompt, core_idea: prompt.toLowerCase() };
  }
  return { prompt: `Describe something you learned this week (${Date.now() % 1000}).`, core_idea: "learning" };
}

const FILLERS = ["um", "uh", "like", "actually", "basically", "you know", "i think", "so", "kind of"];

export function mockSpeechFeedback(transcript: string, metrics: AudioMetrics): SpeechFeedback {
  const lower = ` ${transcript.toLowerCase()} `;
  const filler_words = FILLERS.map((w) => ({
    word: w,
    count: (lower.match(new RegExp(`\\b${w}\\b`, "g")) ?? []).length,
  })).filter((f) => f.count > 0);
  const fillerTotal = filler_words.reduce((s, f) => s + f.count, 0);
  const words = transcript.toLowerCase().match(/[a-z']+/g) ?? [];
  const freq = new Map<string, number>();
  words.forEach((w) => w.length > 4 && freq.set(w, (freq.get(w) ?? 0) + 1));
  const repeated_words = [...freq.entries()].filter(([, c]) => c >= 3).map(([word, count]) => ({ word, count }));
  const variety = words.length ? new Set(words).size / words.length : 0;
  const fluency = Math.max(30, 90 - metrics.longPauses * 5 - fillerTotal * 2);
  const vocabulary = Math.round(Math.min(95, 45 + variety * 70));
  const s = { fluency, grammar: 72, vocabulary, pronunciation: 78, clarity: 75, confidence: Math.max(35, 85 - fillerTotal * 2), content: Math.min(90, 40 + words.length / 3) };
  const scores = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.round(v)])) as SpeechFeedback["scores"];
  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 7);
  return {
    overall,
    scores,
    extra_scores: [],
    summary: "Development preview feedback (AI not configured). Scores are estimated from simple heuristics.",
    strengths: words.length > 60 ? ["You kept talking for most of the time."] : ["You started speaking — that is the hardest part."],
    improvements: [
      ...(fillerTotal ? [`You used filler words ${fillerTotal} times.`] : []),
      ...(metrics.longPauses ? [`You had ${metrics.longPauses} long pauses.`] : []),
    ],
    rewrites: [],
    filler_words,
    grammar_issues: [],
    repeated_words,
    vocab_suggestions: [],
    pronunciation_notes: [],
    delivery: { pace: `${metrics.wpm} words per minute`, tone: "Not assessed in preview mode", confidence: "Estimated from filler usage" },
    content_notes: { relevance: "Not assessed", organization: "Not assessed", examples: "Not assessed" },
    recommendation: "Configure AI to unlock detailed feedback.",
    metrics,
  };
}

export function mockTurn(responders: { name: string; personality: string }[], last?: ConvMessage): ConvMessage[] {
  return responders.map((r) => ({
    speaker: r.name,
    personality: r.personality,
    content: last
      ? `I hear your point about "${last.content.slice(0, 60)}…", but what evidence supports it? Let me offer the opposite view.`
      : "Let's begin. I'll open with my position and then hear yours.",
  }));
}

export function mockConversationFeedback(): ConversationFeedback {
  return {
    overall: 70,
    metrics: [{ label: "Participation", score: 70 }, { label: "Relevance", score: 70 }],
    summary: "Development preview feedback (AI not configured).",
    strongest_point: "—",
    weakest_point: "—",
    best_response: "—",
    observations: [],
    suggestions: ["Configure AI to unlock detailed feedback."],
    rewrites: [],
    filler_words: [],
  };
}

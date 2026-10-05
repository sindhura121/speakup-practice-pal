// Client-safe shared types for AI features.
export type Mode = "speaking" | "debate" | "gd" | "interview" | "storytelling" | "picture";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export const CORE_METRICS = [
  "fluency",
  "grammar",
  "vocabulary",
  "pronunciation",
  "clarity",
  "confidence",
  "content",
] as const;
export type CoreMetric = (typeof CORE_METRICS)[number];

export type AudioMetrics = {
  durationSec: number;
  speakingSec: number;
  longPauses: number;
  longestPauseSec: number;
  wordCount: number;
  wpm: number;
};

export type SpeechFeedback = {
  overall: number;
  scores: Record<CoreMetric, number>;
  extra_scores: { label: string; score: number }[];
  summary: string;
  strengths: string[];
  improvements: string[];
  rewrites: { original: string; better: string }[];
  filler_words: { word: string; count: number }[];
  grammar_issues: { text: string; correction: string; explanation: string }[];
  repeated_words: { word: string; count: number }[];
  vocab_suggestions: { word: string; alternatives: string[] }[];
  pronunciation_notes: string[];
  delivery: { pace: string; tone: string; confidence: string };
  content_notes: { relevance: string; organization: string; examples: string };
  recommendation: string;
  metrics?: AudioMetrics;
};

export type ConvMessage = { speaker: string; content: string; isUser?: boolean; personality?: string };

export type ConversationFeedback = {
  overall: number;
  metrics: { label: string; score: number }[];
  summary: string;
  strongest_point: string;
  weakest_point: string;
  best_response: string;
  observations: string[];
  suggestions: string[];
  rewrites: { original: string; better: string }[];
  filler_words: { word: string; count: number }[];
};

export const CATEGORIES = [
  "Education", "Technology", "AI", "Career", "Workplace", "Society", "Social Media", "Environment",
  "Science", "Economy", "Psychology", "Relationships", "Daily Life", "Sports", "Entertainment", "Books",
  "Travel", "Culture", "Ethics", "Future", "Innovation", "College Life", "Programming",
  "Personal Development", "Abstract", "Situational", "Controversial", "Current Affairs",
];

export const DEBATE_PERSONALITIES = [
  { id: "logical", name: "Lena", label: "Logical", desc: "Structured, step-by-step reasoning" },
  { id: "aggressive", name: "Rex", label: "Aggressive", desc: "Pushes hard, challenges every claim" },
  { id: "calm", name: "Mira", label: "Calm", desc: "Composed, measured counterpoints" },
  { id: "analytical", name: "Dev", label: "Analytical", desc: "Data, trade-offs and second-order effects" },
  { id: "devils_advocate", name: "Sol", label: "Devil's Advocate", desc: "Takes the uncomfortable angle" },
  { id: "beginner", name: "Tomi", label: "Beginner", desc: "Simple arguments, good for warming up" },
  { id: "expert", name: "Dr. Ada", label: "Expert", desc: "Deep domain knowledge, precise rebuttals" },
] as const;

export const GD_PERSONALITIES = [
  { id: "moderator", name: "Priya", label: "Moderator", desc: "Opens, manages time and closes" },
  { id: "logical", name: "Arjun", label: "Logical Speaker", desc: "Structured arguments" },
  { id: "quiet", name: "Noor", label: "Quiet Speaker", desc: "Speaks rarely, but meaningfully" },
  { id: "aggressive", name: "Kabir", label: "Aggressive Speaker", desc: "Frequently challenges others" },
  { id: "fact_based", name: "Elena", label: "Fact-Based Speaker", desc: "Evidence and statistics" },
  { id: "balanced", name: "Sam", label: "Balanced Speaker", desc: "Keeps the discussion flowing" },
  { id: "creative", name: "Yuki", label: "Creative Thinker", desc: "Unexpected angles and analogies" },
  { id: "skeptic", name: "Marco", label: "Skeptic", desc: "Questions assumptions" },
  { id: "practical", name: "Zara", label: "Practical Speaker", desc: "Real-world implementation" },
] as const;

export const INTERVIEW_TYPES = [
  { id: "hr", label: "HR Interview", desc: "Motivation, fit, strengths and goals" },
  { id: "behavioral", label: "Behavioral", desc: "STAR-style stories about past situations" },
  { id: "technical", label: "Technical", desc: "Explain concepts and solve problems aloud" },
  { id: "placement", label: "Placement", desc: "Campus placement mix for freshers" },
] as const;

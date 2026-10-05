// Lightweight lexical near-duplicate detection used alongside AI-side semantic avoidance.
const STOP = new Set(
  "a an the of to for in on at by and or but is are be been should would could will can do does not no it its this that these those with as from about than more most less their they them we our you your i my me he she his her who what why how when which into over under between all any some very just also so if then because there have has had was were being people".split(
    " ",
  ),
);
const SYN: Record<string, string> = {
  chatgpt: "ai", gpt: "ai", "artificial": "ai", intelligence: "ai", assignments: "homework", assignment: "homework",
  students: "student", pupils: "student", kids: "child", children: "child", schools: "school", jobs: "job",
  employees: "worker", workers: "worker", staff: "worker", allowed: "allow", permitted: "allow", banned: "ban",
  prohibited: "ban", smartphones: "phone", phones: "phone", mobile: "phone", universities: "college",
  university: "college", colleges: "college",
};

export function tokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const raw of s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (!raw || STOP.has(raw)) continue;
    let w = SYN[raw] ?? raw;
    if (w.length > 4 && w.endsWith("s")) w = w.slice(0, -1);
    out.add(SYN[w] ?? w);
  }
  return out;
}

export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

export function isTooSimilar(candidate: string, history: string[], threshold = 0.6) {
  return history.some((h) => similarity(candidate, h) >= threshold);
}

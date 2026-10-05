import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2" />
        </svg>
      </span>
      <span>Speak<span className="text-primary">Up</span></span>
    </span>
  );
}

export function ScoreRing({ value, size = 120, stroke = 10, label, className }: { value: number; size?: number; stroke?: number; label?: string; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 80 ? "var(--color-success)" : v >= 60 ? "var(--color-primary)" : "var(--color-warning)";
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-muted)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          style={{ transition: "stroke-dashoffset 900ms ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display font-extrabold leading-none" style={{ fontSize: size * 0.28 }}>
          {Math.round(v)}
        </div>
        {label && <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>}
      </div>
    </div>
  );
}

export function ScoreBar({ label, value, delta }: { label: string; value: number; delta?: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium capitalize">{label}</span>
        <span className="flex items-center gap-2 tabular-nums">
          {delta != null && delta !== 0 && (
            <span className={cn("text-xs font-semibold", delta > 0 ? "text-success" : "text-destructive")}>
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
          <span className="font-semibold">{Math.round(v)}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", v >= 80 ? "bg-success" : v >= 60 ? "bg-primary" : "bg-warning")}
          style={{ width: `${v}%`, transition: "width 800ms ease" }}
        />
      </div>
    </div>
  );
}

export function fmtTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const AVATAR_TONES = ["bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-ink"];
export function Avatar({ name, className, ai }: { name: string; className?: string; ai?: boolean }) {
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "relative inline-grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground",
        AVATAR_TONES[h % AVATAR_TONES.length],
        className,
      )}
    >
      {name.replace(/^Dr\.\s*/, "").charAt(0).toUpperCase()}
      {ai && <span className="absolute -bottom-1 -right-1 rounded-full bg-card px-1 text-[9px] font-bold text-foreground ring-1 ring-border">AI</span>}
    </span>
  );
}

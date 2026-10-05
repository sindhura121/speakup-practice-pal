import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function Pills<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            value === o.value ? "border-ink bg-ink text-ink-foreground" : "bg-card hover:bg-secondary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pills with a "Custom" option that reveals a seconds input. */
export function DurationPicker({ presets, value, onChange, unit = "sec", min = 0, max = 900 }: { presets: { value: number; label: string }[]; value: number; onChange: (v: number) => void; unit?: string; min?: number; max?: number }) {
  const isPreset = presets.some((p) => p.value === value);
  const [custom, setCustom] = useState(!isPreset);
  return (
    <div className="space-y-3">
      <Pills
        options={[...presets.map((p) => ({ value: String(p.value), label: p.label })), { value: "custom", label: "Custom" }]}
        value={custom ? "custom" : String(value)}
        onChange={(v) => {
          if (v === "custom") setCustom(true);
          else {
            setCustom(false);
            onChange(Number(v));
          }
        }}
      />
      {custom && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
      )}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export const SPEAK_DURATIONS = [
  { value: 30, label: "30 sec" },
  { value: 60, label: "1 min" },
  { value: 120, label: "2 min" },
  { value: 180, label: "3 min" },
  { value: 300, label: "5 min" },
];
export const PREP_TIMES = [
  { value: 0, label: "No prep" },
  { value: 15, label: "15 sec" },
  { value: 30, label: "30 sec" },
  { value: 60, label: "1 min" },
];
export const DIFFICULTIES = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

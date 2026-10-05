import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchSessions, MODE_LABEL } from "@/lib/stats";
import { fmtTime } from "@/components/brand";
import { Pills } from "@/components/options";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/history/")({
  head: () => ({ meta: [{ title: "Session history — SpeakUp" }, { name: "description", content: "Every practice session, score and transcript." }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ["sessions"], queryFn: fetchSessions });
  const [mode, setMode] = useState("all");
  const list = (data ?? []).filter((s) => mode === "all" || s.mode === mode);
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold">History</h1>
      <Pills className="mt-6" options={[{ value: "all", label: "All" }, ...Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label }))]} value={mode} onChange={setMode} />
      {isLoading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : list.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No sessions yet.</p>
          <Button asChild className="mt-4"><Link to="/practice/speak">Start your first speech</Link></Button>
        </div>
      ) : (
        <div className="mt-6 divide-y overflow-hidden rounded-3xl border bg-card">
          {list.map((s) => (
            <Link key={s.id} to="/history/$id" params={{ id: s.id }} className="flex items-center gap-4 p-4 transition hover:bg-secondary/60 sm:p-5">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary font-display text-xl font-extrabold">{s.overall_score ?? "–"}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.prompt}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {MODE_LABEL[s.mode]} · {format(new Date(s.created_at), "d MMM yyyy")} · {fmtTime(s.duration_sec)}
                  {s.attempt_of && " · retry"}
                  {s.recording_path && " · 🎧"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

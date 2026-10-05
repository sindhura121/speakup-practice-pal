import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, Copy, Flag, Loader2, LogOut, MoreVertical, Play, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { conversationTurn, evaluateConversation } from "@/lib/ai/ai.functions";
import type { ConvMessage } from "@/lib/ai/types";
import { speak } from "@/lib/audio";
import { Avatar } from "@/components/brand";
import { MessageList, type AiParticipant } from "@/components/conversation";
import { TurnRecorder } from "@/components/turn-recorder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/rooms/$code")({
  head: ({ params }) => ({ meta: [{ title: `Room ${params.code} — SpeakUp` }, { name: "description", content: "Live SpeakUp practice room." }] }),
  component: RoomPage,
});

type Room = Tables<"rooms">;
type Participant = Tables<"room_participants">;
type Msg = Tables<"room_messages">;

function RoomPage() {
  const { code } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const turnFn = useServerFn(conversationTurn);
  const evalFn = useServerFn(evaluateConversation);
  const [room, setRoom] = useState<Room | null>(null);
  const [people, setPeople] = useState<Participant[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [report, setReport] = useState<Participant | null>(null);
  const [reason, setReason] = useState("");
  const msgsRef = useRef<Msg[]>([]);
  const lastHandled = useRef<string | null>(null);
  const prevStatus = useRef<string | null>(null);
  const name = profile?.display_name ?? "You";
  const isHost = room?.host_id === user?.id;
  const ai = (room?.ai_personalities as AiParticipant[] | null) ?? [];
  const active = people.filter((p) => !p.left_at);
  const me = people.find((p) => p.user_id === user?.id);

  const loadPeople = useCallback(async (roomId: string) => {
    const { data } = await supabase.from("room_participants").select("*").eq("room_id", roomId).order("joined_at");
    setPeople(data ?? []);
  }, []);

  // load + join
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: r } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
      if (!r) return setError("This room doesn't exist. Check the code and try again.");
      const { data: blocked } = await supabase.from("user_blocks").select("blocked_id").eq("blocked_id", r.host_id);
      if (blocked?.length && r.host_id !== user.id) return setError("You blocked the host of this room.");
      const { data: mine } = await supabase.from("room_participants").select("id").eq("room_id", r.id).eq("user_id", user.id).maybeSingle();
      if (!mine) {
        if (r.status !== "waiting") return setError("This session has already started.");
        const { error: jErr } = await supabase.from("room_participants").insert({ room_id: r.id, display_name: name, side: null });
        if (jErr) return setError("Couldn't join this room.");
        const { count } = await supabase.from("room_participants").select("id", { count: "exact", head: true }).eq("room_id", r.id);
        if ((count ?? 0) > r.capacity) {
          await supabase.from("room_participants").delete().eq("room_id", r.id).eq("user_id", user.id);
          return setError("This room is full.");
        }
      } else {
        await supabase.from("room_participants").update({ left_at: null }).eq("room_id", r.id).eq("user_id", user.id);
      }
      if (cancelled) return;
      setRoom(r);
      prevStatus.current = r.status;
      await loadPeople(r.id);
      const { data: m } = await supabase.from("room_messages").select("*").eq("room_id", r.id).order("created_at");
      msgsRef.current = m ?? [];
      setMsgs(msgsRef.current);
      lastHandled.current = msgsRef.current.at(-1)?.id ?? null;
    })();
    return () => {
      cancelled = true;
    };
  }, [code, user, name, loadPeople]);

  // realtime
  useEffect(() => {
    if (!room) return;
    const ch = supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${room.id}` }, () => void loadPeople(room.id))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, (p) => setRoom(p.new as Room))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` }, (p) => {
        const m = p.new as Msg;
        if (msgsRef.current.some((x) => x.id === m.id)) return;
        msgsRef.current = [...msgsRef.current, m];
        setMsgs(msgsRef.current);
        if (m.is_ai) speak(m.content, m.personality ?? "");
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [room?.id, loadPeople]); // eslint-disable-line react-hooks/exhaustive-deps

  // countdown when going live
  useEffect(() => {
    if (!room) return;
    if (prevStatus.current === "waiting" && room.status === "live") setCountdown(3);
    prevStatus.current = room.status;
  }, [room?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (countdown == null) return;
    if (countdown === 0) {
      const t = setTimeout(() => setCountdown(null), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const toConv = (list: Msg[]): ConvMessage[] => list.map((m) => ({ speaker: m.speaker_name, content: m.content, personality: m.personality ?? undefined, isUser: m.user_id === user?.id && !m.is_ai }));

  const runAi = useCallback(
    async (phase: "open" | "reply" | "close") => {
      if (!room || !ai.length) return;
      setAiBusy(true);
      const responders = room.kind === "debate" ? ai.slice(0, 2) : [...ai].sort(() => Math.random() - 0.5).slice(0, Math.min(2, ai.length));
      const r = await turnFn({ data: { kind: room.kind as "debate" | "gd", topic: room.topic, userName: "the human participants", userSide: null, responders, history: toConv(msgsRef.current), phase } });
      setAiBusy(false);
      if (!r.ok) return toast.error(r.error);
      for (const m of r.data.messages) {
        await supabase.from("room_messages").insert({ room_id: room.id, user_id: null, is_ai: true, speaker_name: m.speaker, personality: m.personality ?? null, content: m.content });
      }
    },
    [room, ai, turnFn], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // host drives AI replies after each human message
  useEffect(() => {
    if (!isHost || room?.status !== "live" || aiBusy || !ai.length) return;
    const last = msgs.at(-1);
    if (!last || last.is_ai || last.id === lastHandled.current) return;
    lastHandled.current = last.id;
    void runAi("reply");
  }, [msgs, isHost, room?.status, aiBusy, ai.length, runAi]);

  const startSession = async () => {
    if (!room) return;
    await supabase.from("rooms").update({ status: "live", started_at: new Date().toISOString() }).eq("id", room.id);
    if (ai.length) setTimeout(() => void runAi("open"), 3500);
  };
  const endSession = async () => {
    if (!room) return;
    await supabase.from("rooms").update({ status: "ended" }).eq("id", room.id);
  };
  const leave = async () => {
    if (room && user) await supabase.from("room_participants").update({ left_at: new Date().toISOString() }).eq("room_id", room.id).eq("user_id", user.id);
    navigate({ to: room?.kind === "gd" ? "/gd" : "/debate" });
  };
  const postTurn = async (text: string) => {
    if (!room || !user) return;
    const { data } = await supabase.from("room_messages").insert({ room_id: room.id, user_id: user.id, speaker_name: name, content: text }).select("*").single();
    if (data && !msgsRef.current.some((x) => x.id === data.id)) {
      msgsRef.current = [...msgsRef.current, data];
      setMsgs(msgsRef.current);
    }
  };
  const block = async (p: Participant) => {
    await supabase.from("user_blocks").insert({ blocked_id: p.user_id });
    toast.success(`${p.display_name} is blocked. You won't be matched again.`);
  };
  const submitReport = async () => {
    if (!report || !room) return;
    await supabase.from("user_reports").insert({ reported_user_id: report.user_id, room_id: room.id, reason: reason || "Unspecified" });
    toast.success("Report sent. Thank you for keeping SpeakUp safe.");
    setReport(null);
    setReason("");
  };
  const getFeedback = async () => {
    if (!room) return;
    const conv = toConv(msgsRef.current).map((m) => (m.isUser ? { ...m, speaker: name } : m));
    if (!conv.some((m) => m.isUser)) return toast.error("You didn't speak in this session, so there's nothing to evaluate.");
    setEvaluating(true);
    const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
    const total = conv.reduce((a, m) => a + words(m.content), 0);
    const mine = conv.filter((m) => m.isUser).reduce((a, m) => a + words(m.content), 0);
    const sharePct = total ? Math.round((mine / total) * 100) : 0;
    const r = await evalFn({ data: { kind: room.kind as "debate" | "gd", topic: room.topic, userName: name, userSide: me?.side ?? null, history: conv, sharePct } });
    if (!r.ok) {
      setEvaluating(false);
      return toast.error(r.error);
    }
    const { data, error: e } = await supabase
      .from("practice_sessions")
      .insert({
        mode: room.kind,
        prompt: room.topic,
        config: { room: room.code, participants: active.length + ai.length, type: ai.length ? "mixed" : room.is_public ? "strangers" : "friends", sharePct } as never,
        duration_sec: Math.round(mine / 2.3),
        overall_score: r.data.overall,
        scores: Object.fromEntries(r.data.metrics.map((m) => [m.label.toLowerCase(), m.score])) as never,
        feedback: { ...r.data, kind: "conversation", sharePct, messages: conv } as never,
        transcript: conv.map((m) => `${m.speaker}: ${m.content}`).join("\n"),
      })
      .select("id")
      .single();
    setEvaluating(false);
    if (e) return toast.error(e.message);
    navigate({ to: "/history/$id", params: { id: data.id } });
  };

  if (error)
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-2xl font-bold">{error}</h1>
        <Button asChild className="mt-6">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  if (!room) return <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const link = typeof window !== "undefined" ? `${window.location.origin}/rooms/${room.code}` : "";
  const ready = active.length >= room.capacity;

  return (
    <div className="mx-auto flex max-w-3xl flex-col lg:h-[calc(100vh-5rem)]">
      {countdown != null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/90">
          <span className="font-display text-[10rem] font-extrabold text-ink-foreground">{countdown === 0 ? "Start!" : countdown}</span>
        </div>
      )}
      <div className="border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-lg bg-secondary px-2.5 py-1 font-mono text-sm font-bold">{room.code}</span>
          <div className="flex gap-2">
            {isHost && room.status === "live" && (
              <Button size="sm" variant="outline" onClick={() => void endSession()}>
                <Power className="h-4 w-4" /> End session
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => void leave()}>
              <LogOut className="h-4 w-4" /> Leave
            </Button>
          </div>
        </div>
        <div className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{room.kind === "debate" ? "Debate motion" : "Discussion topic"}</div>
        <h2 className="mt-1 font-display text-xl font-bold">{room.topic}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {active.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-card py-1 pl-1 pr-2 text-sm ring-1 ring-border">
              <Avatar name={p.display_name} className="h-6 w-6 text-xs" />
              {p.display_name}
              {p.user_id === room.host_id && <span className="text-xs text-muted-foreground">host</span>}
              {p.side && <span className="text-xs text-muted-foreground">· {p.side}</span>}
              {p.user_id !== user?.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label="Participant options">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setReport(p)}>
                      <Flag className="h-4 w-4" /> Report
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void block(p)}>
                      <Ban className="h-4 w-4" /> Block
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </span>
          ))}
          {ai.map((a) => (
            <span key={a.name} className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-1 pr-2 text-sm">
              <Avatar name={a.name} className="h-6 w-6 text-xs" />
              {a.name} <span className="text-xs text-muted-foreground">AI · {a.label}</span>
            </span>
          ))}
        </div>
      </div>

      {room.status === "waiting" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div>
            <h3 className="text-2xl font-bold">Waiting for participants…</h3>
            <p className="mt-1 text-muted-foreground">
              {active.length}/{room.capacity} participants joined{ai.length ? ` · ${ai.length} AI ready` : ""}
            </p>
          </div>
          {!room.is_public && (
            <div className="w-full max-w-md rounded-2xl border bg-card p-4 text-left">
              <div className="text-sm font-semibold">Invite friends</div>
              <div className="mt-2 flex gap-2">
                <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 text-sm">{link}</code>
                <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Link copied"))}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Or share the room code <b>{room.code}</b> — friends can enter it on their dashboard.
              </p>
            </div>
          )}
          {isHost ? (
            <Button size="lg" onClick={() => void startSession()} disabled={active.length < 2 && !ai.length}>
              <Play className="h-4 w-4" /> {ready ? "Start session" : "Start with who's here"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">The host will start the session.</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto py-6">
            {msgs.length === 0 && <p className="text-center text-muted-foreground">Session is live — anyone can take the first turn.</p>}
            <MessageList messages={toConv(msgs)} userName={name} personalityLabel={(p) => ai.find((a) => a.personality === p)?.label} />
            {aiBusy && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> AI participants are responding…
              </div>
            )}
          </div>
          <div className="border-t pt-4">
            {room.status === "live" ? (
              <TurnRecorder maxSec={room.duration_sec} onTurn={(t) => postTurn(t)} />
            ) : (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <p className="font-semibold">The session has ended.</p>
                <Button onClick={() => void getFeedback()} disabled={evaluating}>
                  {evaluating && <Loader2 className="h-4 w-4 animate-spin" />} Get my feedback
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {report?.display_name}</DialogTitle>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened?" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReport(null)}>Cancel</Button>
            <Button onClick={() => void submitReport()}>Send report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

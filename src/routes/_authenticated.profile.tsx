import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/brand";
import { DIFFICULTIES, Field, Pills } from "@/components/options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — SpeakUp" }, { name: "description", content: "Manage your SpeakUp profile." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [level, setLevel] = useState("intermediate");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setLevel(profile.level);
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ id: user.id, display_name: name.trim() || "Speaker", level });
    setBusy(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile saved");
  };
  const clearHistory = async () => {
    if (!confirm("Clear your prompt history? Previously used prompts may appear again.")) return;
    await supabase.from("prompt_history").delete().eq("user_id", user!.id);
    toast.success("Prompt history cleared");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-4">
        <Avatar name={name || "S"} className="h-16 w-16 text-2xl" />
        <div>
          <h1 className="text-3xl font-bold">{profile?.display_name}</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </div>
      <div className="mt-8 space-y-8 rounded-3xl border bg-card p-6 sm:p-8">
        <Field label="Display name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Speaking level" hint="Used as your default difficulty and for stranger matchmaking.">
          <Pills options={DIFFICULTIES} value={level} onChange={setLevel} />
        </Field>
        <Button onClick={() => void save()} disabled={busy}>Save changes</Button>
      </div>
      <div className="mt-6 rounded-3xl border bg-card p-6 sm:p-8">
        <h2 className="font-bold">Privacy</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your recordings and transcripts are private to your account.</p>
        <Button variant="outline" className="mt-4" onClick={() => void clearHistory()}>Reset prompt history</Button>
      </div>
    </div>
  );
}

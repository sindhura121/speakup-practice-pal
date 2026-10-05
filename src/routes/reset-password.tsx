import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — SpeakUp" },
      { name: "description", content: "Choose a new password for your SpeakUp account." },
      { property: "og:title", content: "Set a new password — SpeakUp" },
      { property: "og:description", content: "Choose a new password for your SpeakUp account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <Logo />
        <h1 className="text-3xl font-bold">Set a new password</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <Button className="w-full" disabled={busy}>
          Update password
        </Button>
      </form>
    </div>
  );
}

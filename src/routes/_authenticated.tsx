import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { BarChart3, History, Home, LogOut, Menu, Swords, Users, Briefcase, Mic } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, Logo } from "@/components/brand";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.href } });
  },
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/practice/speak", label: "Speak", icon: Mic },
  { to: "/debate", label: "Debate", icon: Swords },
  { to: "/gd", label: "Group Discussion", icon: Users },
  { to: "/interview", label: "Interview", icon: Briefcase },
  { to: "/progress", label: "Progress", icon: BarChart3 },
  { to: "/history", label: "History", icon: History },
] as const;

function NavLinks({ onClick }: { onClick?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onClick}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          activeProps={{ className: "bg-secondary text-foreground" }}
        >
          <n.icon className="h-4 w-4" />
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

function AppLayout() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const name = profile?.display_name ?? user?.email?.split("@")[0] ?? "You";
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };
  const Footer = (
    <div className="mt-auto space-y-1 border-t pt-4">
      <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-secondary">
        <Avatar name={name} className="h-8 w-8" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="truncate text-xs text-muted-foreground capitalize">{profile?.level ?? "intermediate"}</div>
        </div>
      </Link>
      <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </div>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r bg-sidebar p-5 lg:flex">
        <Link to="/dashboard">
          <Logo />
        </Link>
        <NavLinks />
        {Footer}
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/dashboard">
          <Logo className="text-lg" />
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col gap-6 p-5">
            <Logo />
            <NavLinks onClick={() => setOpen(false)} />
            {Footer}
          </SheetContent>
        </Sheet>
      </header>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}


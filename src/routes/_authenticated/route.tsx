import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Cloud, FolderOpen, Shield, LogOut } from "lucide-react";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const tabs = [
  { to: "/dashboard", label: "My Files", icon: FolderOpen },
  { to: "/admin", label: "Admin", icon: Shield },
] as const;

function tabClass(active: boolean) {
  return cn(
    "flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
    active ? "text-primary" : "text-muted-foreground",
  );
}

function AuthLayout() {
  const logout = async () => {
    haptic("medium");
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* App top bar */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-elegant">
              <Cloud className="size-4" />
            </span>
            <span className="tracking-tight">
              <span className="text-gradient">Ashish</span>
              <span className="text-foreground"> Cloud</span>
            </span>
          </Link>
          <nav className="ml-4 hidden gap-1 md:flex">
            {tabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                activeProps={{ className: "text-foreground bg-accent" }}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Sign out"
              className="hidden md:inline-flex"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile app tab bar */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-3 items-stretch px-2">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              onClick={() => haptic("light")}
              className={tabClass(false)}
              activeProps={{ className: tabClass(true) }}
            >
              <t.icon className="size-5" />
              {t.label}
            </Link>
          ))}
          <button onClick={logout} className={tabClass(false)}>
            <LogOut className="size-5" />
            Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}

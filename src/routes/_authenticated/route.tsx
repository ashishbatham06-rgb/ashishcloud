import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Cloud, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-elegant">
              <Cloud className="size-4" />
            </span>
            <span className="tracking-tight">
              <span className="text-gradient">Ashish</span><span> Cloud</span>
            </span>
          </Link>
          <nav className="ml-4 flex gap-1">
            <Link to="/dashboard" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "text-foreground bg-accent" }}>
              My files
            </Link>
            <Link to="/admin" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "text-foreground bg-accent" }}>
              Admin
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="size-4 mr-1.5" />Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-8">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

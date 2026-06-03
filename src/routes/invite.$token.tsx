import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { resolveInvite, acceptInvite } from "@/lib/api/invite.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [{ title: "Accept your invite — Ashish Cloud" }],
  }),
  component: Invite,
});

function Invite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const resolveFn = useServerFn(resolveInvite);
  const acceptFn = useServerFn(acceptInvite);
  const [info, setInfo] = useState<{ email: string; role: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    resolveFn({ data: { token } })
      .then((r) => setInfo(r))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Invalid invite."));
  }, [token, resolveFn]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setBusy(true);
    try {
      await acceptFn({ data: { token, password: pw, displayName: name || undefined } });
      const { error } = await supabase.auth.signInWithPassword({ email: info.email, password: pw });
      if (error) throw error;
      toast.success("Account ready.");
      navigate({ to: info.role === "admin" ? "/admin" : "/dashboard" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not accept invite.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12">
        <Card className="w-full max-w-md p-8 glass shadow-elegant">
          {error ? (
            <>
              <h1 className="font-display text-2xl font-semibold">Invalid invitation</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </>
          ) : !info ? (
            <p className="text-sm text-muted-foreground">Checking your invitation…</p>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold">Welcome to Ashish Cloud</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Setting up <strong>{info.email}</strong> ({info.role}).
              </p>
              <form className="mt-6 space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="name">Display name (optional)</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw">Password (min 10 chars)</Label>
                  <Input id="pw" type="password" autoComplete="new-password" required minLength={10} value={pw} onChange={(e) => setPw(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy || pw.length < 10}>
                  {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Create account
                </Button>
              </form>
            </>
          )}
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { startAdminOtp, verifyAdminOtp } from "@/lib/api/auth.functions";
import { toast } from "sonner";
import {
  InputOTP, InputOTPGroup, InputOTPSlot,
} from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Ashish Cloud" },
      { name: "description", content: "Sign in to your Ashish Cloud account." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const startOtp = useServerFn(startAdminOtp);
  const verifyOtp = useServerFn(verifyAdminOtp);
  const [stage, setStage] = useState<"creds" | "otp">("creds");
  const [email, setEmail] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("rem-email")) || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submitCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (remember) localStorage.setItem("rem-email", email);
      else localStorage.removeItem("rem-email");
      const res = await startOtp();
      if (res.needsOtp) {
        setStage("otp");
        toast.success("Code sent to your email.");
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed.";
      toast.error(msg);
      await supabase.auth.signOut().catch(() => null);
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await verifyOtp({ data: { code } });
      navigate({ to: "/admin" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Wrong code.";
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
          <h1 className="font-display text-2xl font-semibold">{stage === "creds" ? "Welcome back" : "Verify it's you"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stage === "creds" ? "Sign in to your Ashish Cloud workspace." : "Enter the 6-digit code we sent to your email."}
          </p>
          {stage === "creds" ? (
            <form className="mt-6 space-y-4" onSubmit={submitCreds}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} /> Remember my email
              </label>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Sign in
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                No account? Invitations are sent by the admin.
              </p>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={submitOtp}>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
                {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Verify
              </Button>
              <button type="button" className="text-xs text-muted-foreground underline mx-auto block" onClick={async () => { await startOtp(); toast.success("New code sent."); }}>
                Resend code
              </button>
            </form>
          )}
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}

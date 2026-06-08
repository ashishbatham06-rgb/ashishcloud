import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { freeSignup } from "@/lib/api/signup.functions";
import { getMsg91Config } from "@/lib/api/msg91.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Phone, ShieldCheck, KeyRound, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your free account — Ashish Cloud" },
      { name: "description", content: "Sign up for 1 GB of free private cloud storage. No card required." },
    ],
  }),
  component: Signup,
});

type Msg91Success = { message?: string; type?: string; access_token?: string } | string;
type Msg91Cb = (data: Msg91Success) => void;

function extractToken(d: Msg91Success): string {
  if (typeof d === "string") return d;
  return d.access_token ?? d.message ?? "";
}

function useMsg91(widgetId: string, tokenAuth: string, enabled: boolean) {
  const [ready, setReady] = useState<boolean>(typeof window !== "undefined" && !!window.sendOtp);
  useEffect(() => {
    if (!enabled || !widgetId || !tokenAuth) return;
    if (typeof window === "undefined") return;
    if (window.__msg91Booted && window.sendOtp) { setReady(true); return; }
    const urls = [
      "https://verify.msg91.com/otp-provider.js",
      "https://verify.phone91.com/otp-provider.js",
    ];
    const boot = () => {
      if (typeof window.initSendOTP === "function" && !window.__msg91Booted) {
        window.initSendOTP({
          widgetId, tokenAuth, exposeMethods: true, otpLength: 8,
          success: () => null, failure: () => null,
        });
        window.__msg91Booted = true;
      }
      const poll = setInterval(() => {
        if (window.sendOtp && window.verifyOtp) { clearInterval(poll); setReady(true); }
      }, 100);
      setTimeout(() => clearInterval(poll), 8000);
    };
    let i = 0;
    const tryLoad = () => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-msg91="1"]`);
      if (existing) { boot(); return; }
      const s = document.createElement("script");
      s.src = urls[i]; s.async = true; s.dataset.msg91 = "1";
      s.onload = boot;
      s.onerror = () => { s.remove(); i++; if (i < urls.length) tryLoad(); };
      document.head.appendChild(s);
    };
    tryLoad();
  }, [widgetId, tokenAuth, enabled]);
  return ready;
}

type Stage = "form" | "otp" | "done";

function Signup() {
  const navigate = useNavigate();
  const signupFn = useServerFn(freeSignup);
  const cfgFn = useServerFn(getMsg91Config);

  const [cfg, setCfg] = useState<{ widgetId: string; tokenAuth: string } | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const reqIdRef = useRef<string>("");
  const accessTokenRef = useRef<string>("");

  const ready = useMsg91(cfg?.widgetId ?? "", cfg?.tokenAuth ?? "", stage === "otp");

  useEffect(() => {
    cfgFn().then(setCfg).catch(() => setCfg({ widgetId: "", tokenAuth: "" }));
  }, [cfgFn]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const normalisedPhone = phone.replace(/[^\d+]/g, "");

  const sendOtp = async () => {
    if (!window.sendOtp) { toast.error("OTP service still loading."); return; }
    setBusy(true);
    await new Promise<void>((resolve) => {
      window.sendOtp!(
        normalisedPhone,
        (d) => {
          const reqId = extractToken(d);
          if (reqId) reqIdRef.current = reqId;
          if (typeof d === "object" && d?.access_token) accessTokenRef.current = d.access_token;
          toast.success("OTP sent to your phone.");
          setResendIn(30);
          resolve();
        },
        (e) => {
          const msg = typeof e === "string" ? e : (e?.message ?? "Could not send OTP.");
          toast.error(msg);
          resolve();
        },
      );
    });
    setBusy(false);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email.");
    if (pw.length < 10) return toast.error("Password must be at least 10 characters.");
    if (normalisedPhone.replace(/\D/g, "").length < 8) return toast.error("Enter a valid phone number.");
    setStage("otp");
    for (let i = 0; i < 50; i++) {
      if (window.sendOtp) { sendOtp(); return; }
      await new Promise((r) => setTimeout(r, 150));
    }
    toast.error("OTP service unreachable. Refresh and retry.");
  };

  const verifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 8) return toast.error("Enter the 8-digit OTP.");
    if (!window.verifyOtp) return toast.error("OTP service not ready.");
    setBusy(true);
    try {
      const accessToken: string = await new Promise((resolve, reject) => {
        window.verifyOtp!(
          code,
          (d) => {
            const t = (typeof d === "object" && d?.access_token) || extractToken(d) || accessTokenRef.current;
            if (!t || t.length < 10) return reject(new Error("No access token returned."));
            resolve(t);
          },
          (e2) => reject(new Error(typeof e2 === "string" ? e2 : (e2?.message ?? "Invalid OTP."))),
          reqIdRef.current || undefined,
        );
      });

      await signupFn({
        data: {
          email, password: pw, phone: normalisedPhone,
          msg91Token: accessToken, displayName: name || undefined,
        },
      });

      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (signErr) throw signErr;

      setStage("done");
      toast.success("Welcome to Ashish Cloud!");
      setTimeout(() => navigate({ to: "/dashboard" }), 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not finish signup.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0) return;
    if (!window.retryOtp || !reqIdRef.current) return sendOtp();
    setBusy(true);
    await new Promise<void>((resolve) => {
      window.retryOtp!(
        11,
        () => { toast.success("New OTP sent."); setResendIn(30); resolve(); },
        (e) => {
          const msg = typeof e === "string" ? e : (e?.message ?? "Could not resend.");
          toast.error(msg);
          resolve();
        },
        reqIdRef.current,
      );
    });
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 size-[420px] rounded-full bg-primary/25 blur-[120px] animate-orb" />
          <div className="absolute -bottom-32 -right-32 size-[420px] rounded-full bg-primary-glow/25 blur-[120px] animate-orb-2" />
        </div>
        <Card className="w-full max-w-md p-8 glass shadow-elegant animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-2.5 py-0.5 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-primary" /> Free forever · 1 GB
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold">
            {stage === "form" && "Create your account"}
            {stage === "otp" && "Verify your phone"}
            {stage === "done" && "You're in"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stage === "form" && "Get 1 GB of private cloud storage. Zero egress fees."}
            {stage === "otp" && "Enter the 8-digit code we just sent to your phone."}
            {stage === "done" && "Signing you in…"}
          </p>

          {stage === "form" && (
            <form className="mt-6 space-y-4" onSubmit={submitForm}>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5"><Mail className="size-3.5" /> Email</Label>
                <Input id="email" type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display name (optional)</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw" className="flex items-center gap-1.5"><KeyRound className="size-3.5" /> Password</Label>
                <Input id="pw" type="password" autoComplete="new-password" required minLength={10}
                  value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 10 characters" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5"><Phone className="size-3.5" /> Mobile number</Label>
                <Input id="phone" type="tel" inputMode="tel" required value={phone}
                  onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxxxx" />
                <p className="text-xs text-muted-foreground">
                  We send a one-time code to confirm this number. After that, you sign in with just email + password.
                </p>
              </div>
              <Button type="submit" className="w-full shadow-glow" disabled={busy}>
                {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
                Continue
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          )}

          {stage === "otp" && (
            <form className="mt-6 space-y-5" onSubmit={verifyAndCreate}>
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <span className="text-muted-foreground">Code sent to</span>
                <span className="font-medium">{normalisedPhone}</span>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={8} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5,6,7].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {!ready && (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" /> Loading secure OTP service…
                </p>
              )}
              <Button type="submit" className="w-full shadow-glow" disabled={busy || code.length < 8}>
                {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
                Verify & create account
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => setStage("form")} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <ArrowLeft className="size-3" /> Change details
                </button>
                <button type="button" onClick={resend} disabled={resendIn > 0 || busy}
                  className="text-primary disabled:text-muted-foreground hover:underline disabled:no-underline">
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {stage === "done" && (
            <div className="mt-8 text-center space-y-3">
              <CheckCircle2 className="size-12 mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Welcome aboard.</p>
            </div>
          )}
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}

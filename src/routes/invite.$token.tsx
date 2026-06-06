import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { resolveInvite, acceptInvite } from "@/lib/api/invite.functions";
import { getMsg91Config } from "@/lib/api/msg91.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Phone, ShieldCheck, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [{ title: "Accept your invite — Ashish Cloud" }],
  }),
  component: Invite,
});

// MSG91 widget exposes these on window when exposeMethods: true
type Msg91Success = { message?: string; type?: string; access_token?: string } | string;
type Msg91Cb = (data: Msg91Success) => void;
declare global {
  interface Window {
    initSendOTP?: (cfg: Record<string, unknown>) => void;
    sendOtp?: (identifier: string, success: Msg91Cb, failure: Msg91Cb, retryChannel?: number) => void;
    verifyOtp?: (otp: string | number, success: Msg91Cb, failure: Msg91Cb, reqId?: string) => void;
    retryOtp?: (channel: number | string, success: Msg91Cb, failure: Msg91Cb, reqId?: string) => void;
    __msg91Booted?: boolean;
  }
}

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
          widgetId,
          tokenAuth,
          exposeMethods: true,
          success: () => null,
          failure: () => null,
        });
        window.__msg91Booted = true;
      }
      // Methods are attached shortly after init.
      const poll = setInterval(() => {
        if (window.sendOtp && window.verifyOtp) {
          clearInterval(poll);
          setReady(true);
        }
      }, 100);
      setTimeout(() => clearInterval(poll), 8000);
    };

    let i = 0;
    const tryLoad = () => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-msg91="1"]`);
      if (existing) { boot(); return; }
      const s = document.createElement("script");
      s.src = urls[i];
      s.async = true;
      s.dataset.msg91 = "1";
      s.onload = boot;
      s.onerror = () => {
        s.remove();
        i++;
        if (i < urls.length) tryLoad();
      };
      document.head.appendChild(s);
    };
    tryLoad();
  }, [widgetId, tokenAuth, enabled]);

  return ready;
}

type Stage = "form" | "otp" | "done";

function Invite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const resolveFn = useServerFn(resolveInvite);
  const acceptFn = useServerFn(acceptInvite);
  const cfgFn = useServerFn(getMsg91Config);

  const [info, setInfo] = useState<{ email: string; role: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<{ widgetId: string; tokenAuth: string } | null>(null);

  const [stage, setStage] = useState<Stage>("form");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const accessTokenRef = useRef<string>("");

  const ready = useMsg91(cfg?.widgetId ?? "", cfg?.tokenAuth ?? "", stage === "otp");

  useEffect(() => {
    resolveFn({ data: { token } })
      .then(setInfo)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Invalid invite."));
    cfgFn().then(setCfg).catch(() => setCfg({ widgetId: "", tokenAuth: "" }));
  }, [token, resolveFn, cfgFn]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const normalisedPhone = phone.replace(/[^\d+]/g, "");

  const sendOtp = async () => {
    if (!window.sendOtp) {
      toast.error("OTP service still loading. Try again in a moment.");
      return;
    }
    setBusy(true);
    await new Promise<void>((resolve) => {
      window.sendOtp!(
        normalisedPhone,
        (d) => {
          // Some flows return the access-token here too (auto-verify).
          const t = extractToken(d);
          if (t && t.length > 20) accessTokenRef.current = t;
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
    if (!info) return;
    if (pw.length < 10) return toast.error("Password must be at least 10 characters.");
    if (normalisedPhone.replace(/\D/g, "").length < 8) return toast.error("Enter a valid phone number.");
    setStage("otp");
    // Auto-send once widget is ready
    const tryUntilReady = async () => {
      for (let i = 0; i < 50; i++) {
        if (window.sendOtp) return sendOtp();
        await new Promise((r) => setTimeout(r, 150));
      }
      toast.error("OTP service unreachable. Refresh and retry.");
    };
    tryUntilReady();
  };

  const verifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    if (code.length !== 4 && code.length !== 6) return toast.error("Enter the OTP code.");
    if (!window.verifyOtp) return toast.error("OTP service not ready.");

    setBusy(true);
    try {
      const accessToken: string = await new Promise((resolve, reject) => {
        window.verifyOtp!(
          code,
          (d) => {
            const t = extractToken(d) || accessTokenRef.current;
            if (!t) return reject(new Error("No access token returned."));
            resolve(t);
          },
          (e2) => reject(new Error(typeof e2 === "string" ? e2 : (e2?.message ?? "Invalid OTP."))),
        );
      });

      await acceptFn({
        data: {
          token,
          password: pw,
          phone: normalisedPhone,
          msg91Token: accessToken,
          displayName: name || undefined,
        },
      });

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: info.email,
        password: pw,
      });
      if (signErr) throw signErr;

      setStage("done");
      toast.success("Account ready.");
      setTimeout(() => navigate({ to: info.role === "admin" ? "/admin" : "/dashboard" }), 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not finish signup.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0) return;
    if (!window.retryOtp) return sendOtp();
    setBusy(true);
    await new Promise<void>((resolve) => {
      window.retryOtp!(
        11, // text retry channel
        () => { toast.success("New OTP sent."); setResendIn(30); resolve(); },
        (e) => {
          const msg = typeof e === "string" ? e : (e?.message ?? "Could not resend.");
          toast.error(msg);
          resolve();
        },
      );
    });
    setBusy(false);
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
              <Stepper stage={stage} />
              <header className="mt-6">
                <h1 className="font-display text-2xl font-semibold">
                  {stage === "form" && "Set up your account"}
                  {stage === "otp" && "Verify your phone"}
                  {stage === "done" && "You're in"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  <span>
                    {info.email} <span className="text-muted-foreground/60">·</span>{" "}
                    <span className="capitalize">{info.role}</span>
                  </span>
                </p>
              </header>

              {stage === "form" && (
                <form className="mt-6 space-y-4" onSubmit={submitForm}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Display name (optional)</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Your name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw" className="flex items-center gap-1.5">
                      <KeyRound className="size-3.5" /> Password
                    </Label>
                    <Input id="pw" type="password" autoComplete="new-password" required minLength={10}
                      value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 10 characters" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-1.5">
                      <Phone className="size-3.5" /> Mobile number
                    </Label>
                    <Input id="phone" type="tel" inputMode="tel" required value={phone}
                      onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxxxx" />
                    <p className="text-xs text-muted-foreground">
                      We'll send a one-time code to confirm this number. You'll only sign in with email + password after this.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
                    Continue
                  </Button>
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
                    <InputOTP maxLength={6} value={code} onChange={setCode}>
                      <InputOTPGroup>
                        {[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} />)}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {!ready && (
                    <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                      <Loader2 className="size-3 animate-spin" /> Loading secure OTP service…
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={busy || code.length < 4}>
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
                  <p className="text-sm text-muted-foreground">Signing you in…</p>
                </div>
              )}
            </>
          )}
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stepper({ stage }: { stage: Stage }) {
  const steps = [
    { key: "form", label: "Details" },
    { key: "otp", label: "Verify" },
    { key: "done", label: "Done" },
  ] as const;
  const active = steps.findIndex((s) => s.key === stage);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={
                "grid size-6 place-items-center rounded-full border text-[11px] font-medium " +
                (current
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground")
              }
            >
              {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
            </span>
            <span className={current ? "text-foreground font-medium" : "text-muted-foreground"}>{s.label}</span>
            {i < steps.length - 1 && <span className="h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

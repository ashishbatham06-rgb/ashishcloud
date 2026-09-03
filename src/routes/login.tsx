import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { checkDeviceTrust, trustDeviceWithOtp } from "@/lib/api/device.functions";
import { getMsg91Config } from "@/lib/api/msg91.functions";
import { completePasswordReset, startPasswordReset } from "@/lib/api/password-reset.functions";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, ShieldCheck, ArrowLeft, Phone, KeyRound } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Ashish Cloud" },
      { name: "description", content: "Sign in to your Ashish Cloud account." },
      { property: "og:title", content: "Log in — Ashish Cloud" },
      { property: "og:description", content: "Sign in securely to your Ashish Cloud account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

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

function extractString(d: Msg91Success): string {
  if (typeof d === "string") return d;
  return d?.message ?? d?.access_token ?? "";
}

function getDeviceId(): string {
  if (typeof localStorage === "undefined") return "ssr";
  let id = localStorage.getItem("ac-device-id");
  if (!id) {
    const buf = new Uint8Array(24);
    (globalThis.crypto ?? window.crypto).getRandomValues(buf);
    id = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem("ac-device-id", id);
  }
  return id;
}

function useMsg91(widgetId: string, tokenAuth: string, enabled: boolean) {
  const [ready, setReady] = useState<boolean>(
    typeof window !== "undefined" && !!window.sendOtp,
  );

  useEffect(() => {
    if (!enabled || !widgetId || !tokenAuth) return;
    if (typeof window === "undefined") return;
    if (window.__msg91Booted && window.sendOtp) {
      setReady(true);
      return;
    }
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
          otpLength: 8,
          success: () => null,
          failure: () => null,
        });
        window.__msg91Booted = true;
      }
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

type Stage = "creds" | "otp" | "reset" | "reset-otp";

function Login() {
  const navigate = useNavigate();
  const checkFn = useServerFn(checkDeviceTrust);
  const trustFn = useServerFn(trustDeviceWithOtp);
  const cfgFn = useServerFn(getMsg91Config);
  const startResetFn = useServerFn(startPasswordReset);
  const completeResetFn = useServerFn(completePasswordReset);

  const [stage, setStage] = useState<Stage>("creds");
  const [email, setEmail] = useState(
    () => (typeof localStorage !== "undefined" && localStorage.getItem("rem-email")) || "",
  );
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [cfg, setCfg] = useState<{ widgetId: string; tokenAuth: string } | null>(null);
  const [resetPhone, setResetPhone] = useState("+91");
  const [resetPassword, setResetPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetChallenge, setResetChallenge] = useState("");
  const [resetMaskedPhone, setResetMaskedPhone] = useState("");

  const phoneRef = useRef<string>("");
  const reqIdRef = useRef<string>("");
  const resetReqIdRef = useRef<string>("");

  const ready = useMsg91(cfg?.widgetId ?? "", cfg?.tokenAuth ?? "", stage === "otp" || stage === "reset-otp");

  useEffect(() => {
    cfgFn().then(setCfg).catch(() => setCfg({ widgetId: "", tokenAuth: "" }));
  }, [cfgFn]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const goNext = (admin: boolean) =>
    navigate({ to: admin ? "/admin" : "/dashboard" });

  const sendOtpToPhone = async (phone: string, requestIdRef: React.MutableRefObject<string>, label = "OTP sent to your phone.") => {
    const digits = phone.replace(/[^\d+]/g, "");
    if (!window.sendOtp) {
      toast.error("OTP service still loading. Try again in a moment.");
      return false;
    }
    return new Promise<boolean>((resolve) => {
      window.sendOtp!(
        digits,
        (d) => {
          const reqId = extractString(d);
           if (reqId) requestIdRef.current = reqId;
          setResendIn(30);
           toast.success(label);
          resolve(true);
        },
        (e) => {
          const msg = typeof e === "string" ? e : (e?.message ?? "Could not send OTP.");
          toast.error(msg);
          resolve(false);
        },
      );
    });
  };

  const submitCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (remember) localStorage.setItem("rem-email", email);
      else localStorage.removeItem("rem-email");

      const deviceId = getDeviceId();
      const status = await checkFn({ data: { deviceId } });
      setIsAdmin(status.isAdmin);

      if (status.trusted) {
        goNext(status.isAdmin);
        return;
      }
      if (!status.hasPhone) {
        // No phone on file — can't do OTP, allow login (legacy users).
        goNext(status.isAdmin);
        return;
      }
      phoneRef.current = status.phone!;
      setMaskedPhone(status.maskedPhone);
      setStage("otp");
      // wait until widget is ready then auto-send
      const t0 = Date.now();
      while (!window.sendOtp && Date.now() - t0 < 8000) {
        await new Promise((r) => setTimeout(r, 150));
      }
       await sendOtpToPhone(status.phone, reqIdRef);
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
    if (!window.verifyOtp) return toast.error("OTP service not ready.");
    if (code.length !== 8) return toast.error("Enter the 8-digit OTP.");
    setBusy(true);
    try {
      const accessToken: string = await new Promise((resolve, reject) => {
        window.verifyOtp!(
          code,
          (d) => {
            const t = (typeof d === "object" && d?.access_token) || extractString(d);
            if (!t || t.length < 10) return reject(new Error("No access token returned."));
            resolve(t);
          },
          (e2) => reject(new Error(typeof e2 === "string" ? e2 : (e2?.message ?? "Invalid OTP."))),
           reqIdRef.current || undefined,
        );
      });

      await trustFn({
        data: {
          deviceId: getDeviceId(),
          msg91Token: accessToken,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        },
      });
      toast.success("Device verified.");
      goNext(isAdmin);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const submitResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = resetPhone.replace(/[^\d+]/g, "");
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error("Enter the account email.");
    if (phone.replace(/\D/g, "").length < 8) return toast.error("Enter the registered mobile number.");
    setBusy(true);
    try {
      const result = await startResetFn({ data: { email, phone } });
      if (!result.ok) {
        toast.success("If the details match an account, you can continue with phone verification.");
        return;
      }
      setResetChallenge(result.challengeToken);
      setResetMaskedPhone(result.maskedPhone);
      setResetCode("");
      resetReqIdRef.current = "";
      setStage("reset-otp");
      const started = Date.now();
      while (!window.sendOtp && Date.now() - started < 8000) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      await sendOtpToPhone(phone, resetReqIdRef, "Password reset OTP sent.");
    } catch {
      toast.success("If the details match an account, you can continue with phone verification.");
    } finally {
      setBusy(false);
    }
  };

  const submitResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetCode.length !== 8) return toast.error("Enter the 8-digit OTP.");
    if (resetPassword.length < 10) return toast.error("Password must be at least 10 characters.");
    if (!window.verifyOtp || !resetChallenge) return toast.error("OTP service not ready.");
    setBusy(true);
    try {
      const msg91Token: string = await new Promise((resolve, reject) => {
        window.verifyOtp!(
          resetCode,
          (d) => {
            const token = (typeof d === "object" && d?.access_token) || extractString(d);
            if (!token || token.length < 10) return reject(new Error("No access token returned."));
            resolve(token);
          },
          (failure) => reject(new Error(typeof failure === "string" ? failure : (failure?.message ?? "Invalid OTP."))),
          resetReqIdRef.current || undefined,
        );
      });
      await completeResetFn({ data: { challengeToken: resetChallenge, msg91Token, newPassword: resetPassword } });
      toast.success("Password changed. You can sign in now.");
      setPassword("");
      setResetPassword("");
      setResetCode("");
      setStage("creds");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  };

  const resendReset = async () => {
    if (resendIn > 0 || !resetPhone) return;
    setBusy(true);
    if (window.retryOtp && resetReqIdRef.current) {
      await new Promise<void>((resolve) => {
        window.retryOtp!(11, () => { toast.success("New password reset OTP sent."); setResendIn(30); resolve(); }, () => resolve(), resetReqIdRef.current);
      });
    } else {
      await sendOtpToPhone(resetPhone.replace(/[^\d+]/g, ""), resetReqIdRef, "Password reset OTP sent.");
    }
    setBusy(false);
  };

  const resend = async () => {
    if (resendIn > 0 || !phoneRef.current) return;
    setBusy(true);
    if (window.retryOtp && reqIdRef.current) {
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
    } else {
      await sendOtpToPhone(phoneRef.current);
    }
    setBusy(false);
  };

  const cancelOtp = async () => {
    setStage("creds");
    setCode("");
    reqIdRef.current = "";
    await supabase.auth.signOut().catch(() => null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12">
        <Card className="w-full max-w-md p-8 glass shadow-elegant">
          <h1 className="font-display text-2xl font-semibold">
             {stage === "creds" ? "Welcome back" : stage === "otp" ? "Verify this device" : stage === "reset" ? "Reset your password" : "Verify your phone"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
             {stage === "creds" && "Sign in to your Ashish Cloud workspace."}
             {stage === "otp" && "We sent a one-time code to your registered mobile number. You'll only see this on a new device."}
             {stage === "reset" && "Use your email and registered mobile number to verify ownership."}
             {stage === "reset-otp" && "Enter the 8-digit code sent to your registered mobile number."}
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
               <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setStage("reset")}>
                 Forgot password?
               </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} /> Remember my email
              </label>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Sign in
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                No account? <a href="/signup" className="text-primary hover:underline">Sign up free</a> — 1 GB, no card.
              </p>
            </form>
           ) : stage === "otp" ? (
            <form className="mt-6 space-y-5" onSubmit={submitOtp}>
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <span className="text-muted-foreground">Code sent to</span>
                <span className="font-medium">{maskedPhone}</span>
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
           ) : stage === "reset" ? (
             <form className="mt-6 space-y-4" onSubmit={submitResetRequest}>
               <div className="space-y-2">
                 <Label htmlFor="reset-email">Account email</Label>
                 <Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="reset-phone" className="flex items-center gap-1.5"><Phone className="size-3.5" /> Registered mobile number</Label>
                 <Input id="reset-phone" type="tel" inputMode="tel" autoComplete="tel" required value={resetPhone} onChange={(e) => setResetPhone(e.target.value)} placeholder="+91 98xxxxxxxx" />
               </div>
               <Button type="submit" className="w-full" disabled={busy}>
                 {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Send reset OTP
               </Button>
               <Button type="button" variant="ghost" className="w-full" onClick={() => setStage("creds")}>
                 <ArrowLeft className="size-4 mr-2" /> Back to sign in
               </Button>
             </form>
           ) : (
             <form className="mt-6 space-y-5" onSubmit={submitResetOtp}>
               <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm flex items-center gap-2">
                 <KeyRound className="size-4 text-primary" />
                 <span className="text-muted-foreground">Code sent to</span>
                 <span className="font-medium">{resetMaskedPhone}</span>
               </div>
               <div className="flex justify-center">
                 <InputOTP maxLength={8} value={resetCode} onChange={setResetCode}>
                   <InputOTPGroup>{[0,1,2,3,4,5,6,7].map((i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
                 </InputOTP>
               </div>
               <div className="space-y-2">
                 <Label htmlFor="new-password">New password</Label>
                 <Input id="new-password" type="password" autoComplete="new-password" minLength={10} required value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="At least 10 characters" />
               </div>
               <Button type="submit" className="w-full" disabled={busy || resetCode.length < 8 || resetPassword.length < 10}>
                 {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Verify & change password
               </Button>
               <div className="flex items-center justify-between text-xs">
                 <Button type="button" variant="ghost" size="sm" onClick={() => setStage("reset")}><ArrowLeft className="size-3 mr-1" /> Back</Button>
                 <Button type="button" variant="link" size="sm" onClick={resendReset} disabled={resendIn > 0 || busy}>{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}</Button>
               </div>
             </form>
           )}
              <Button type="submit" className="w-full" disabled={busy || code.length < 8}>
                {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Verify & continue
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={cancelOtp} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <ArrowLeft className="size-3" /> Use a different account
                </button>
                <button type="button" onClick={resend} disabled={resendIn > 0 || busy}
                  className="text-primary disabled:text-muted-foreground hover:underline disabled:no-underline">
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}

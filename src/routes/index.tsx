import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InstallAppBanner } from "@/components/install-app-banner";
import { CloudScene } from "@/components/cloud-scene";
import { ApkDownloadButton } from "@/components/apk-download-button";
import { APK_VERSION } from "@/lib/apk";
import { useIsNativeApp } from "@/hooks/use-native-app";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield, Share2, Upload, Users, KeyRound, Sparkles, Lock, Zap,
  Gauge, Check, Mail, ArrowRight, Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ashish Cloud — Your private cloud, refined" },
      { name: "description", content: "Private cloud storage with zero egress fees. Free tier, blazing-fast transfers, beautiful UI." },
      { property: "og:title", content: "Ashish Cloud — Your private cloud, refined" },
      { property: "og:description", content: "Private cloud storage with zero egress fees. Free tier, blazing-fast transfers." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* ========== HERO ========== */}
        <section className="relative overflow-hidden">
          {/* Animated luxury cloud backdrop */}
          <CloudScene />


          <div className="mx-auto max-w-6xl px-4 pt-24 pb-28 text-center relative">
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-32 -translate-x-1/2 size-[640px] ring-conic animate-spin-slow opacity-60" />
            <div className="relative inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground glass shadow-soft animate-float">
              <Sparkles className="size-3" /> Private. Fast. Yours.
            </div>

            <h1 className="relative mt-8 font-display text-5xl sm:text-7xl font-semibold tracking-tight leading-[1.05] animate-tilt-in">
              Your cloud,
              <br />
              <span className="text-gradient">rebuilt for speed.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Upload, organize and share photos and videos with surgical access control —
              zero egress fees, full line-speed transfers, beautifully simple.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="shadow-glow">
                <Link to="/signup">
                  Start free <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#pricing">See pricing</a>
              </Button>
              <ApkDownloadButton />
            </div>

            {/* Floating preview tile */}
            <div className="relative mx-auto mt-20 max-w-4xl">
              <div aria-hidden className="absolute inset-x-0 -top-10 -bottom-10 bg-gradient-to-b from-primary/10 via-transparent to-transparent blur-2xl" />
              <Card className="relative glass shadow-elegant p-1 rounded-2xl">
                <div className="rounded-xl border bg-card/80 p-8">
                  <div className="grid gap-4 md:grid-cols-3 text-left">
                    {[
                      { icon: Zap, t: "Line-speed uploads", d: "Parallel transfers up to your connection cap." },
                      { icon: Gauge, t: "Zero-egress downloads", d: "Pull your files as much as you want — free." },
                      { icon: Shield, t: "Hardened access", d: "Email + password + 8-digit OTP on new devices." },
                    ].map((x) => (
                      <div key={x.t} className="rounded-lg border bg-background/50 p-4">
                        <x.icon className="size-5 text-primary" />
                        <p className="mt-3 font-semibold text-sm">{x.t}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{x.d}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* ========== FEATURES ========== */}
        <section className="mx-auto max-w-6xl px-4 mt-12">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-4xl font-semibold tracking-tight">Everything you need. Nothing you don't.</h2>
            <p className="mt-3 text-muted-foreground">Designed for the moments your files actually matter.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { icon: Upload, title: "Drag-and-drop everything", desc: "Hundreds of files at once. Pick quality per batch. Resumable transfers." },
              { icon: Share2, title: "Signed share links", desc: "Password, expiry, download cap. Revoke any link in a single click." },
              { icon: Shield, title: "Hardened auth", desc: "OTP-gated signup, per-device verification, full audit trail." },
              { icon: Zap, title: "Free egress, always", desc: "Download as much as you want. Zero bandwidth bills, ever." },
              { icon: Users, title: "Per-user quotas", desc: "Each user gets a private workspace. Admin sets limits instantly." },
              { icon: KeyRound, title: "Encrypted secrets", desc: "Hashed passwords and OTPs. Row-level access on every query." },
            ].map((f) => (
              <Card key={f.title} className="p-6 glass shadow-soft tilt-3d">
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ========== PRICING ========== */}
        <section id="pricing" className="mx-auto max-w-6xl px-4 mt-28 scroll-mt-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-4xl font-semibold tracking-tight">Simple, honest pricing.</h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade when you need more room. Egress is always free.</p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <PricingCard
              name="Free"
              price="₹0"
              period="forever"
              storage="1 GB"
              cta={<Button asChild className="w-full"><Link to="/signup">Sign up free</Link></Button>}
              features={["1 GB storage", "Free downloads (zero egress)", "Signed share links", "8-digit OTP security"]}
            />
            <PricingCard
              highlight
              name="Plan B"
              price="₹30"
              period="/month"
              storage="5 GB"
              cta={
                <Button asChild className="w-full shadow-glow">
                  <a href="mailto:ashishcloudservices@gmail.com?subject=Plan%20B%20-%20Request%20Access">
                    Request access
                  </a>
                </Button>
              }
              features={["5 GB storage", "Free downloads (zero egress)", "Priority signed shares", "Email support"]}
            />
            <PricingCard
              name="Custom / Enterprise"
              price="Custom"
              period="storage & SLA"
              storage="Any size"
              cta={
                <Button asChild variant="outline" className="w-full">
                  <a href="mailto:ashishcloudservices@gmail.com?subject=Enterprise%20-%20Custom%20Plan">
                    <Mail className="size-4 mr-2" /> Contact sales
                  </a>
                </Button>
              }
              features={["Unlimited storage tiers", "Free downloads (zero egress)", "Dedicated workspace", "Custom limits & SLA"]}
            />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Free signup is open. For Plan B and custom plans, email{" "}
            <a className="text-primary underline" href="mailto:ashishcloudservices@gmail.com">
              ashishcloudservices@gmail.com
            </a>
          </p>
        </section>

        {/* ========== SECURITY STRIP ========== */}
        <section className="mx-auto max-w-6xl px-4 mt-24 grid gap-4 md:grid-cols-3">
          {[
            { icon: Lock, t: "Row-level access on every table" },
            { icon: Shield, t: "Server-side quota + size enforcement" },
            { icon: KeyRound, t: "Short-lived signed URLs — keys never leave server" },
          ].map((s) => (
            <div key={s.t} className="flex items-center gap-3 rounded-xl border p-4 glass">
              <s.icon className="size-5 text-primary" />
              <span className="text-sm">{s.t}</span>
            </div>
          ))}
        </section>

        {/* ========== CTA ========== */}
        <section className="mx-auto max-w-6xl px-4 mt-24">
          <Card className="relative overflow-hidden p-10 md:p-14 glass shadow-elegant text-center">
            <div aria-hidden className="absolute -top-24 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-primary/20 blur-[120px]" />
            <h2 className="relative font-display text-4xl font-semibold tracking-tight">Ready to take your cloud back?</h2>
            <p className="relative mt-3 text-muted-foreground">Sign up free in 60 seconds. No card. No nonsense.</p>
            <div className="relative mt-6">
              <Button asChild size="lg" className="shadow-glow">
                <Link to="/signup">Start free <ArrowRight className="ml-1 size-4" /></Link>
              </Button>
            </div>
          </Card>
        </section>
      </main>
      <InstallAppBanner />
      <SiteFooter />
    </div>
  );
}

function PricingCard({
  name, price, period, storage, features, cta, highlight,
}: {
  name: string; price: string; period: string; storage: string;
  features: string[]; cta: React.ReactNode; highlight?: boolean;
}) {
  return (
    <Card className={`relative p-7 glass ${highlight ? "shadow-glow border-primary/40" : "shadow-soft"}`}>
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground shadow-elegant">
          Most popular
        </span>
      )}
      <h3 className="font-display text-xl font-semibold">{name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-muted-foreground">{period}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{storage} storage · 0 egress fees</p>
      <ul className="mt-5 space-y-2.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="size-4 text-primary mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7">{cta}</div>
    </Card>
  );
}

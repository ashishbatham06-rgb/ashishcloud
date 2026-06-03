import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cloud, Shield, Share2, Upload, Users, KeyRound, Sparkles, Lock } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ashish Cloud — Private cloud storage with zero-egress S3 power" },
      { name: "description", content: "Invite-only personal cloud storage built on Cloudflare R2. Encrypted shares, admin-grade controls, beautiful UI." },
      { property: "og:title", content: "Ashish Cloud" },
      { property: "og:description", content: "Invite-only personal cloud storage built on Cloudflare R2." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground glass shadow-soft">
            <Sparkles className="size-3" /> Invite-only. Engineered for privacy.
          </div>
          <h1 className="mt-6 font-display text-5xl sm:text-6xl font-semibold tracking-tight">
            Your private corner of the cloud,
            <br />
            <span className="text-gradient">backed by Cloudflare R2.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Upload, organize, and share photos and videos with end-to-end controlled access — zero egress fees, hard quotas, OTP-gated admin, audit-logged everything.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/login">Open the app</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/how-it-works">How it works</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Need an invite? Email <a className="underline" href="mailto:ashish01raikwar@gmail.com">ashish01raikwar@gmail.com</a></p>
        </section>

        {/* Features grid */}
        <section className="mx-auto max-w-6xl px-4 grid gap-4 md:grid-cols-3">
          {[
            { icon: Upload, title: "Bulk upload + quality picker", desc: "Drop hundreds of files at once. Pick Original, High, or Medium quality per batch." },
            { icon: Share2, title: "Signed share links", desc: "One-click share with optional password, expiry, and download caps. Revocable anytime." },
            { icon: Shield, title: "Hardened auth", desc: "Invite-only signup. Admin login = password + email OTP. Full audit trail of every action." },
            { icon: Cloud, title: "Cloudflare R2 power", desc: "S3-compatible storage with zero egress fees — your data, your bandwidth, no surprises." },
            { icon: Users, title: "Per-user quotas", desc: "Each user gets a dedicated workspace and quota. Admin can grow or shrink instantly." },
            { icon: KeyRound, title: "Encrypted secrets", desc: "Bcrypt-hashed OTPs and share-link passwords. RLS-enforced row access for every query." },
          ].map((f) => (
            <Card key={f.title} className="p-6 glass shadow-soft">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </section>

        {/* Pricing band */}
        <section className="mx-auto max-w-6xl px-4 mt-20">
          <Card className="p-8 md:p-10 glass shadow-elegant">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Pricing</div>
                <h2 className="mt-2 font-display text-3xl font-semibold">Free up to R2 included tier</h2>
                <p className="mt-3 text-muted-foreground">10 GB storage, 1M Class A ops, 10M Class B ops per month — included. Overages billed exactly at Cloudflare cost. Admin sees live billing in the dashboard.</p>
              </div>
              <div className="rounded-xl border bg-card p-6 text-sm">
                <Row label="Storage" value="$0.015 / GB-month (over 10 GB)" />
                <Row label="Class A ops" value="$4.50 / million (over 1M)" />
                <Row label="Class B ops" value="$0.36 / million (over 10M)" />
                <Row label="Egress" value="$0 (zero) — always" highlight />
              </div>
            </div>
          </Card>
        </section>

        {/* Security strip */}
        <section className="mx-auto max-w-6xl px-4 mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: Lock, t: "Row-level security on every table" },
            { icon: Shield, t: "Server-side quota + size enforcement" },
            { icon: KeyRound, t: "Presigned URLs — keys never leave server" },
          ].map((s) => (
            <div key={s.t} className="flex items-center gap-3 rounded-xl border p-4 glass">
              <s.icon className="size-5 text-primary" />
              <span className="text-sm">{s.t}</span>
            </div>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold text-success" : "font-medium"}>{value}</span>
    </div>
  );
}

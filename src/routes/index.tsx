import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InstallAppBanner } from "@/components/install-app-banner";
import { ApkDownloadButton } from "@/components/apk-download-button";
import { APK_VERSION } from "@/lib/apk";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Shield, Share2, Upload, Users, KeyRound, Zap, Lock,
  ArrowRight, Smartphone, Image as ImageIcon, Video as VideoIcon,
  FileIcon, Folder, Cloud,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ashish Cloud — Your private cloud, refined" },
      { name: "description", content: "Private cloud storage with blazing-fast transfers, albums, and signed share links. Free signup." },
      { property: "og:title", content: "Ashish Cloud — Your private cloud, refined" },
      { property: "og:description", content: "Private cloud storage with blazing-fast transfers, albums, and signed share links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Ashish Cloud — Your private cloud, refined" },
      { name: "twitter:description", content: "Private cloud storage with blazing-fast transfers, albums, and signed share links." },
    ],
  }),
  component: Landing,
});

const mockTiles = [
  { icon: ImageIcon, label: "IMG_2041", tint: "bg-primary/10 text-primary" },
  { icon: VideoIcon, label: "Trip.mp4", tint: "bg-chart-3/10 text-chart-3" },
  { icon: ImageIcon, label: "Sunset.jpg", tint: "bg-chart-2/10 text-chart-2" },
  { icon: FileIcon, label: "Notes.pdf", tint: "bg-chart-5/10 text-chart-5" },
  { icon: ImageIcon, label: "Group.png", tint: "bg-primary/10 text-primary" },
  { icon: VideoIcon, label: "Birthday", tint: "bg-chart-4/10 text-chart-4" },
] as const;

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div aria-hidden className="absolute -inset-8 rounded-[3rem] bg-gradient-to-b from-primary/15 via-primary-glow/10 to-transparent blur-2xl" />
      <div className="relative rounded-[2.2rem] border bg-card shadow-elegant p-2.5">
        <div className="rounded-[1.7rem] border bg-background overflow-hidden">
          {/* app bar */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
              <Cloud className="size-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">My Files</span>
            <span className="ml-auto size-2 rounded-full bg-success" />
          </div>
          {/* storage */}
          <div className="px-4 pt-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Storage used</span>
              <span className="font-medium text-foreground">2.4 GB</span>
            </div>
            <Progress value={24} className="mt-1.5 h-1.5" />
          </div>
          {/* folder chip */}
          <div className="mt-3 px-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
              <Folder className="size-3" /> Birthday
            </span>
          </div>
          {/* grid */}
          <div className="grid grid-cols-3 gap-2 p-4">
            {mockTiles.map((t) => (
              <div key={t.label} className="rounded-xl border bg-card p-2.5 shadow-soft">
                <t.icon className={`size-5 ${t.tint.split(" ")[1]} ${t.tint.split(" ")[0]}`} />
                <p className="mt-2 truncate text-[9px] text-muted-foreground">{t.label}</p>
              </div>
            ))}
          </div>
          {/* tab bar */}
          <div className="grid grid-cols-3 border-t px-4 py-2 text-center">
            {["Files", "Shared", "You"].map((t, i) => (
              <span key={t} className={`text-[9px] font-medium ${i === 0 ? "text-primary" : "text-muted-foreground/60"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* ========== HERO ========== */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[560px] bg-mesh opacity-60" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 md:grid-cols-2 md:pt-24">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground shadow-soft">
                <Zap className="size-3 text-primary" /> Private. Fast. Yours.
              </div>
              <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight leading-[1.05] animate-tilt-in">
                Your cloud,
                <br />
                <span className="text-gradient">in your pocket.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground md:mx-0">
                Upload photos and videos at full speed, keep them in tidy folders,
                and share with a link — all from a clean, simple app.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <Button asChild size="lg" className="shadow-glow">
                  <Link to="/signup">
                    Start free <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
                <ApkDownloadButton />
              </div>
            </div>
            <div className="relative">
              <PhoneMockup />
            </div>
          </div>
        </section>

        {/* ========== FEATURES ========== */}
        <section className="mx-auto max-w-6xl px-4 mt-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-4xl font-semibold tracking-tight">Everything you need. Nothing you don't.</h2>
            <p className="mt-3 text-muted-foreground">Designed for the moments your files actually matter.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { icon: Upload, title: "Bulk uploads at full speed", desc: "Hundreds of photos and videos at once, uploaded in parallel on your connection's full bandwidth." },
              { icon: Share2, title: "Signed share links", desc: "Password, expiry, download cap. Revoke any link in a single click." },
              { icon: Shield, title: "Hardened auth", desc: "OTP-gated signup, per-device verification, full audit trail." },
              { icon: Users, title: "Your private space", desc: "Every user gets their own private workspace with a clear storage meter." },
              { icon: Folder, title: "Tidy folders", desc: "Group moments into folders like Birthday or School trip, and browse them like an album." },
              { icon: KeyRound, title: "Encrypted secrets", desc: "Hashed passwords and OTPs. Row-level access on every query." },
            ].map((f) => (
              <Card key={f.title} className="p-6 shadow-soft">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ========== SECURITY STRIP ========== */}
        <section className="mx-auto max-w-6xl px-4 mt-20 grid gap-4 md:grid-cols-3">
          {[
            { icon: Lock, t: "Row-level access on every table" },
            { icon: Shield, t: "Server-side quota + size enforcement" },
            { icon: KeyRound, t: "Short-lived signed URLs — keys never leave server" },
          ].map((s) => (
            <div key={s.t} className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft">
              <s.icon className="size-5 text-primary" />
              <span className="text-sm">{s.t}</span>
            </div>
          ))}
        </section>

        {/* ========== ANDROID APP STRIP ========== */}
        <section className="mx-auto max-w-6xl px-4 mt-20">
          <Card className="relative overflow-hidden p-8 md:p-10 shadow-soft">
            <div aria-hidden className="absolute -right-16 -top-16 size-64 rounded-full bg-primary/15 blur-[100px]" />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Smartphone className="size-6" />
                </span>
                <div>
                  <h3 className="font-display text-2xl font-semibold tracking-tight">Take your cloud in your pocket.</h3>
                  <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                    The official Ashish Cloud Android app — direct APK install, no Play Store, no tracking. Same hardened login, same full-speed uploads.
                  </p>
                </div>
              </div>
              <div className="relative flex flex-col items-center gap-2">
                <ApkDownloadButton />
                <span className="text-[11px] text-muted-foreground/80">Latest release · {APK_VERSION}</span>
              </div>
            </div>
          </Card>
        </section>

        {/* ========== CTA ========== */}
        <section className="mx-auto max-w-6xl px-4 mt-20 mb-8">
          <Card className="relative overflow-hidden p-10 md:p-14 shadow-elegant text-center">
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

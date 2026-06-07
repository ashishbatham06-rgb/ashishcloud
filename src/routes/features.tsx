import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Upload, Download, Share2, Shield, Users, Receipt, Trash2, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Ashish Cloud" },
      { name: "description", content: "Bulk upload, signed share links, admin controls — your private cloud, refined." },
    ],
  }),
  component: Features,
});

const items = [
  { icon: Upload, title: "Bulk drag-and-drop upload", desc: "Drop files or whole folders. Parallel transfers stream directly to storage at full line speed." },
  { icon: Download, title: "Multi-select downloads", desc: "Grab many files at once. Each download streams direct from the edge — no proxy hops." },
  { icon: Share2, title: "Smart share links", desc: "Optional password, expiry, and download cap. Revoke anytime; usage tracked per link." },
  { icon: ImageIcon, title: "Media previews", desc: "Inline image, video, and PDF previews in a clean lightbox." },
  { icon: Trash2, title: "Trash with restore", desc: "Soft delete first. Restore within 30 days before objects are permanently removed." },
  { icon: Users, title: "User management", desc: "Admin invites by email. Adjust quota, disable, or remove users in one click." },
  { icon: Receipt, title: "Live usage dashboard", desc: "Per-user storage, bandwidth and activity — at a glance." },
  { icon: Shield, title: "Audit log", desc: "Every login, upload, download, share, and admin action is recorded." },
];

function Features() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-6xl px-4 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Features</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">Crafted for small teams and personal vaults. Every interaction is logged, every byte is accounted for.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {items.map((f) => (
            <Card key={f.title} className="p-6 glass">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

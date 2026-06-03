import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Upload, Download, Share2, Shield, Users, Receipt, Trash2, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Ashish Cloud" },
      { name: "description", content: "Everything Ashish Cloud does: bulk upload/download, signed share links, admin controls, live billing." },
    ],
  }),
  component: Features,
});

const items = [
  { icon: Upload, title: "Bulk drag-and-drop upload", desc: "Drop files or whole folders. Quality picker (Original/High/Medium). Resumable presigned PUTs straight to R2." },
  { icon: Download, title: "Multi-select downloads", desc: "Select many files, download each as a clean, presigned URL — no proxying through our servers." },
  { icon: Share2, title: "Smart share links", desc: "Optional password (bcrypt-hashed), expiry, and download cap. Revoke anytime; usage tracked." },
  { icon: ImageIcon, title: "Media previews", desc: "Inline image, video, and PDF previews in a clean lightbox." },
  { icon: Trash2, title: "Trash with restore", desc: "Soft delete first. Restore within 30 days before objects are permanently removed from R2." },
  { icon: Users, title: "User management", desc: "Admin invites by email. Adjust quota, disable, or delete users in one click." },
  { icon: Receipt, title: "Live R2 billing", desc: "Admin dashboard shows storage, Class A & B ops, and live overage cost based on Cloudflare R2 pricing." },
  { icon: Shield, title: "Audit log", desc: "Every login, upload, download, share, and admin action is recorded with IP and user agent." },
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

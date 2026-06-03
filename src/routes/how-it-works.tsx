import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — Ashish Cloud" },
      { name: "description", content: "Step-by-step: get an invite, sign in, upload, share, manage." },
    ],
  }),
  component: How,
});

const steps = [
  { n: "01", title: "Request an invite", body: "Email the admin at ashish01raikwar@gmail.com. The admin generates a signed, single-use invite link sent to your inbox." },
  { n: "02", title: "Accept the invite", body: "Click the link, set a strong password (checked against breach databases). Your account opens immediately with your own quota." },
  { n: "03", title: "Sign in", body: "Email + password. Normal users land in their workspace. Admins are prompted for a 6-digit code mailed to their registered address." },
  { n: "04", title: "Upload anything", body: "Drag and drop files or folders. Pick a quality preset. Uploads stream straight from your browser to Cloudflare R2 via presigned URLs." },
  { n: "05", title: "Share with control", body: "Generate a share link. Add a password, an expiry, or a download cap. Revoke whenever you want." },
  { n: "06", title: "Admin oversight", body: "The admin dashboard shows every user's storage usage, full audit history, and live R2 billing calculated against the included tier." },
];

function How() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-4xl px-4 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">How it works</h1>
        <p className="mt-3 text-muted-foreground">Six steps. No extension to install, no surprises.</p>
        <ol className="mt-10 space-y-4">
          {steps.map((s) => (
            <Card key={s.n} className="p-6 glass flex gap-5">
              <div className="font-display text-3xl font-semibold text-gradient">{s.n}</div>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </Card>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </div>
  );
}

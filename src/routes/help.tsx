import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — Ashish Cloud" },
      { name: "description", content: "Answers to common questions about Ashish Cloud." },
    ],
  }),
  component: Help,
});

const faqs = [
  { q: "How do I get an account?", a: "Accounts are invite-only. Email ashish01raikwar@gmail.com and the admin will send a one-time signup link to your inbox." },
  { q: "What's the upload limit?", a: "Each file can be up to 1 GB. Each user has a configurable storage quota (default 5 GB) that the admin can raise or lower." },
  { q: "How do shares work?", a: "Generate a link from any file. Add a password, an expiry, or a maximum download count. Visitors hit /api/public/s/<token> — we validate every request before redirecting them to a short-lived presigned R2 URL." },
  { q: "Is my data encrypted?", a: "All transfers use TLS. Files live in your Cloudflare R2 bucket. Auth, OTPs, and share-link passwords are bcrypt-hashed; access is gated by Postgres row-level security on every table." },
  { q: "What does admin login look like?", a: "Admin sign-in requires email + password AND a 6-digit code sent to the admin's registered email. Codes expire in 10 minutes and are invalidated after 5 wrong attempts." },
  { q: "Can I delete a file forever?", a: "Yes. Deletes mark the row first (recoverable for 30 days), then the R2 object is removed and quota is freed." },
  { q: "How is billing calculated?", a: "The admin dashboard reads live counters (storage GB, Class A/B ops) and applies Cloudflare R2 pricing — only the amount over the included tier is charged: $0.015/GB-mo, $4.50/M Class A, $0.36/M Class B." },
];

function Help() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Help Center</h1>
        <p className="mt-3 text-muted-foreground">Short answers to the most common questions.</p>
        <Accordion type="single" collapsible className="mt-8">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`i-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
      <SiteFooter />
    </div>
  );
}

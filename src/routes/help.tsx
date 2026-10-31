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
  { q: "How do I get an account?", a: "Free accounts are open — sign up directly from the login page. For extra storage or anything special, email ashishcloudservices@gmail.com." },
  { q: "What's the upload limit?", a: "Each file can be up to 1 GB. Your storage quota is shown on the dashboard, and admins can raise it anytime." },
  { q: "How do shares work?", a: "Generate a link from any file. Add a password, expiry, or maximum download count. Every visitor goes through a validation step before getting a short-lived download URL." },
  { q: "Is my data encrypted?", a: "All transfers use TLS. Storage is encrypted at rest. Passwords and OTPs are hashed; row-level access control gates every query." },
  { q: "How does sign-in work?", a: "First-time signup requires email + password + an 8-digit SMS OTP to verify your number. After that, the same device logs in with just email + password. A new device triggers another OTP for safety." },
  { q: "Can I delete a file forever?", a: "Yes. Deletes mark the row first (recoverable for 30 days), then the object is permanently removed and your quota is freed." },
  { q: "What about egress fees?", a: "Zero. Downloads are free, always." },
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

import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Ashish Cloud" },
      { name: "description", content: "Reach the Ashish Cloud admin to request an invite or get support." },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Get in touch</h1>
        <p className="mt-3 text-muted-foreground">For invites, support, or feedback — email the admin directly.</p>
        <Card className="mt-8 p-8 glass shadow-elegant flex items-center gap-5">
          <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-elegant">
            <Mail className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Admin email</p>
            <a href="mailto:ashish01raikwar@gmail.com" className="text-xl font-semibold tracking-tight hover:text-primary">
              ashish01raikwar@gmail.com
            </a>
          </div>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}

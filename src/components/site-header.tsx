import { Link } from "@tanstack/react-router";
import { Cloud } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/help", label: "Help" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 glass border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-display font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-elegant">
            <Cloud className="size-4" />
          </span>
          <span className="tracking-tight">
            <span className="text-gradient">Ashish</span>
            <span className="text-foreground"> Cloud</span>
          </span>
        </Link>
        <nav className="ml-4 hidden gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "text-foreground bg-accent" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm" variant="ghost">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/login">Open app</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

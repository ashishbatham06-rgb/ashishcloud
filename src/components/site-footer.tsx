import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t mt-24">
      <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Ashish Cloud — private storage, built for speed.</p>
        <div className="flex flex-wrap gap-4">
          <span className="hidden sm:inline text-xs text-muted-foreground/80">Install our Web APK: Chrome menu (⋮) → Install app</span>
          <Link to="/help" className="hover:text-foreground">Help</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
          <a href="mailto:ashishcloudservices@gmail.com" className="hover:text-foreground">ashishcloudservices@gmail.com</a>
        </div>
      </div>
    </footer>
  );
}

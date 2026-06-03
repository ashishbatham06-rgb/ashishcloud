import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t mt-24">
      <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Ashish Cloud — built for serious privacy.</p>
        <div className="flex gap-4">
          <Link to="/help" className="hover:text-foreground">Help</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
          <a href="mailto:ashish01raikwar@gmail.com" className="hover:text-foreground">ashish01raikwar@gmail.com</a>
        </div>
      </div>
    </footer>
  );
}

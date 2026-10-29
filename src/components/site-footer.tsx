import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useIsNativeApp } from "@/hooks/use-native-app";
import { APK_DOWNLOAD_URL, APK_VERSION } from "@/lib/apk";

export function SiteFooter() {
  const isNative = useIsNativeApp();

  return (
    <footer className="border-t mt-24">
      <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Ashish Cloud — private storage, built for speed.</p>
        <div className="flex flex-wrap gap-4 items-center">
          {!isNative && (
            <a
              href={APK_DOWNLOAD_URL}
              download
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <Download className="size-3 text-primary" />
              Android APK ({APK_VERSION})
            </a>
          )}
          <Link to="/help" className="hover:text-foreground">Help</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
          <a href="mailto:ashishcloudservices@gmail.com" className="hover:text-foreground">ashishcloudservices@gmail.com</a>
        </div>
      </div>
    </footer>
  );
}

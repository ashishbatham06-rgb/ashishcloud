import { Smartphone, Download } from "lucide-react";
import { APK_DOWNLOAD_URL, APK_VERSION, APK_SIZE_HINT } from "@/lib/apk";
import { useIsNativeApp } from "@/hooks/use-native-app";

/**
 * Premium standalone download pill for the official Android APK.
 * Hidden inside the native app shell.
 */
export function ApkDownloadButton({ className = "" }: { className?: string }) {
  const isNative = useIsNativeApp();
  if (isNative) return null;

  return (
    <a
      href={APK_DOWNLOAD_URL}
      download
      className={`group relative inline-flex items-center gap-3 overflow-hidden rounded-full border bg-card/70 px-5 py-3 text-sm font-medium shadow-soft backdrop-blur transition-all duration-300 hover:shadow-glow hover:border-primary/50 hover:-translate-y-0.5 ${className}`}
    >
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/15 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <span className="relative grid size-8 place-items-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
        <Smartphone className="size-4" />
      </span>
      <span className="relative flex flex-col items-start leading-tight">
        <span>
          Download Android APK
          <Download className="ml-1.5 inline size-3.5 text-primary transition-transform group-hover:translate-y-0.5" />
        </span>
        <span className="text-[11px] text-muted-foreground">
          {APK_VERSION} · {APK_SIZE_HINT} · No Play Store needed
        </span>
      </span>
    </a>
  );
}

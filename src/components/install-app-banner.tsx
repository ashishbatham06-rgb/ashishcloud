import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsNativeApp } from "@/hooks/use-native-app";
import { APK_DOWNLOAD_URL } from "@/lib/apk";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ashishcloud-install-hint-dismissed";

export function InstallAppBanner() {
  const isNative = useIsNativeApp();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      if (!dismissed) setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Show the guidance version even before Chrome fires the prompt (mobile Chrome often
    // only exposes "Install app" from the ⋮ menu).
    const t = window.setTimeout(() => {
      if (!dismissed) setVisible(true);
    }, 1500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(t);
    };
  }, []);

  if (isNative || !visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:left-6 sm:bottom-6 sm:max-w-md">
      <div className="rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Get Ashish Cloud as an app</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {installEvent
                ? "Install the Web APK on your device — one tap, no Play Store needed."
                : "Download our Web APK: open the Chrome menu (⋮) and tap “Install app” or “Add to Home screen”."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss install hint"
            onClick={dismiss}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {installEvent && (
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={async () => {
              try {
                await installEvent.prompt();
                await installEvent.userChoice;
              } catch {
                /* user dismissed */
              }
              setVisible(false);
            }}
          >
            Install Web APK
          </Button>
        )}
      </div>
    </div>
  );
}

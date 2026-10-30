import { useEffect, useState } from "react";
import { CloudOff, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/use-network-status";

/**
 * Non-blocking glass banner shown whenever the device loses connectivity.
 * Tells the user what still works and what needs internet.
 */
export function OfflineBanner() {
  const online = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      return;
    }
    if (wasOffline) {
      toast.success("Back online");
      setWasOffline(false);
    }
  }, [online, wasOffline]);

  if (online) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card/85 px-4 py-3 shadow-lg backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15">
        <WifiOff className="h-4 w-4 text-destructive" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">You're offline</p>
        <p className="truncate text-xs text-muted-foreground">
          Uploads, downloads and sharing need internet. Reconnect and try again.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5 rounded-full"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}

export function CloudOffIcon({ className }: { className?: string }) {
  return <CloudOff className={className} />;
}

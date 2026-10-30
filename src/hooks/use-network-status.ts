import { useEffect, useState } from "react";

/**
 * True while the browser reports an active connection.
 * Defaults to true on the server (SSR) and updates from real events after hydration.
 */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  let msg = "";
  if (error instanceof Error) msg = error.message;
  else if (error && typeof error === "object" && "message" in error)
    msg = String((error as { message: unknown }).message);
  return /failed to fetch|network ?error|networkerror|load failed|fetch failed|network request failed|internet disconnected/i.test(
    msg,
  );
}

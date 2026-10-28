import { useEffect, useState } from "react";
import type { CapacitorGlobal } from "@capacitor/core";

/**
 * True only when the web app is running inside the native Android/iOS shell
 * (Capacitor WebView), not in a normal browser or PWA context.
 */
export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    setIsNative(Boolean(cap?.isNativePlatform?.()));
  }, []);

  return isNative;
}

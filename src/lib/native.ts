import type { CapacitorGlobal } from "@capacitor/core";

/**
 * Native Android chrome (Capacitor shell) helpers.
 *
 * All browser/Capacitor access happens inside functions (never at module
 * scope) so this module is safe to import from SSR-reachable routes.
 * Every helper is a no-op in a normal browser or PWA context.
 */

type HapticKind = "light" | "medium" | "heavy" | "success" | "warning" | "error";

function capacitor(): CapacitorGlobal | undefined {
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(capacitor()?.isNativePlatform?.());
}

// Matches the light/dark surface tokens in src/styles.css.
const SURFACE = {
  light: "#FCFCFD",
  dark: "#17141F",
};

/** Set the Android status bar to match the current light/dark theme. */
async function applyStatusBarTheme(dark: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? SURFACE.dark : SURFACE.light });
  } catch {
    // Plugin not available (older APK build) — harmless.
  }
}

/**
 * Initialize native chrome once from a useEffect (root component):
 * status bar styling that follows the app theme.
 */
export function initNativeChrome(): void {
  if (!isNative()) return;
  const root = document.documentElement;
  const sync = () => void applyStatusBarTheme(root.classList.contains("dark"));
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
}

/** Fire-and-forget haptic feedback inside the native app (no-op on web). */
export function haptic(kind: HapticKind = "light"): void {
  if (!isNative()) return;
  void (async () => {
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
      if (kind === "light") await Haptics.impact({ style: ImpactStyle.Light });
      else if (kind === "medium") await Haptics.impact({ style: ImpactStyle.Medium });
      else if (kind === "heavy") await Haptics.impact({ style: ImpactStyle.Heavy });
      else if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
      else if (kind === "warning") await Haptics.notification({ type: NotificationType.Warning });
      else await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // No-op when the plugin is missing.
    }
  })();
}

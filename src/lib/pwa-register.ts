// Service worker registration wrapper. This is the ONLY place /sw.js is
// registered; it refuses registration in dev, Lovable previews, iframes and
// when the URL carries ?sw=off, and unregisters any matching app SW there.

const SW_PATH = "/sw.js";
// Preview first-DNS-labels on Lovable preview domains (main, numbered draft,
// commit and workspace-branded previews).
const PREVIEW_LABEL_RE = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;
const PROJECT_ID = "849a3cdc-53c6-4add-b25c-aebe6d66a883";
// Exact delegated main-preview host from project_urls--get_urls.
const DELEGATED_PREVIEW_HOSTS = new Set([
  `id-preview--${PROJECT_ID}.lovable.app`,
]);
const DEV_PROJECT_HOSTS = new Set(
  ["lovable.app", "gpt-eng.com", "gptengineer.run"].map(
    (suffix) => `project--${PROJECT_ID}-dev.${suffix}`,
  ),
);

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  if (window.self !== window.top) return true; // iframe preview

  const host = window.location.hostname.toLowerCase();
  if (DELEGATED_PREVIEW_HOSTS.has(host)) return true;
  if (DEV_PROJECT_HOSTS.has(host)) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;

  const firstLabel = host.split(".")[0];
  const isPreviewDomain =
    host.endsWith(".lovable.app") ||
    host.endsWith(".gpt-eng.com") ||
    host.endsWith(".gptengineer.run");
  if (isPreviewDomain && PREVIEW_LABEL_RE.test(firstLabel)) return true;

  return false;
}

async function unregisterAppSw(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) =>
          [r.active, r.waiting, r.installing].some(
            (sw) => sw?.scriptURL.endsWith(SW_PATH),
          ),
        )
        .map((r) => r.unregister()),
    );
  } catch {
    // best effort only
  }
}

export async function registerPwa(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  let off = false;
  try {
    off = new URL(window.location.href).searchParams.has("sw", "off");
  } catch {
    off = false;
  }
  if (off || isRefusedContext()) {
    await unregisterAppSw();
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch (err) {
    console.warn("[pwa] service worker registration failed", err);
  }
}

// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [
      // Offline app-shell support. Registration itself happens only from the
      // guarded wrapper in src/lib/pwa-register.ts (never in dev/preview).
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        manifest: false, // public/manifest.webmanifest already exists
        includeAssets: ["favicon.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
        devOptions: { enabled: false },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          // Do not precache server-rendered HTML; navigations are cached at runtime instead.
          globPatterns: ["assets/**/*.{js,css,woff2,png,svg,jpg,webp,ico}"],
          runtimeCaching: [
            {
              // HTML navigations: NetworkFirst (never cache-first), so the latest
              // app shell is used and the last good shell is the offline fallback.
              urlPattern: ({ request, url }: { request: Request; url: URL }) =>
                request.mode === "navigate" &&
                !url.pathname.startsWith("/api") &&
                !url.pathname.startsWith("/s/") &&
                url.pathname !== "/~oauth",
              handler: "NetworkFirst",
              options: {
                cacheName: "ashish-html",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              // Hashed build assets: CacheFirst (same-origin immutable assets only).
              urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/assets/"),
              handler: "CacheFirst",
              options: {
                cacheName: "ashish-assets",
                expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
      }),
    ],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

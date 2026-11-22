# Plan — Ashish Cloud secure gateway

## Audit findings
- Most dashboard/admin actions already call server functions on Ashish Cloud; file reads use the short-lived `/api/gw/file/...` gateway and uploads use `/api/upload`.
- Login, signup, invite completion, session checks, and sign-out still call the Cloud auth service directly from the browser.
- The standalone Expo app also calls Cloud auth and the Data API directly for sign-in, file lists, folders, and profile data.
- The MSG91 widget is loaded by the browser; it is a third-party request, separate from database/storage access.

## Build
1. Add a first-party gateway auth/session flow using secure, HttpOnly, same-site cookies; proxy sign-in, refresh, sign-out, signup completion, and invite completion server-side.
2. Move browser session checks and upload authentication to that gateway; add origin/CSRF checks, short-lived auth, refresh rotation, strict input validation, rate limits, and replay protections where state changes permit them.
3. Move the Expo app's auth and user-scoped reads to same-origin mobile gateway APIs; keep its native bearer flow compatible while removing direct Data API calls.
4. Keep all file bytes behind the existing authorized gateway; validate that privileged database and storage credentials remain server-only, RLS and private storage remain enforced, and unauthorized IDs are rejected.
5. Test login/signup/invite, device OTP, dashboard reads, upload, view/download/share, logout, Android WebView behavior, and rejection cases; inspect the production-facing browser request destinations.

## Important security boundary
The browser will show requests made by that browser, even when they use one gateway. HTTPS protects traffic from passive network observers, but the user, browser developer tools, compromised device, and gateway server can inspect their respective plaintext. App-layer encryption cannot hide data from a client that must display or upload it. TLS 1.3 negotiation is controlled by the hosting edge, not guaranteed by frontend code; verify it at the published domain after deployment.

## Scope note
The MSG91 widget remains a direct third-party browser connection unless its OTP delivery flow is separately replaced; no privileged key will be exposed to hide that request. Existing public APIs, share links, and Capacitor WebView behavior will be preserved.
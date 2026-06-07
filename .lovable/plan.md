# Plan — OTP fix + Invisly-style redesign + pricing/perf updates

Big batch of changes. I'll ship them all in one pass.

## 1. OTP: 6 → 8 digits
- Login + invite pages: change OTP input length to 8 (MSG91 widget config + any local validators).
- Anywhere `length={6}` / `maxLength: 6` for OTP → `8`.

## 2. Brand & messaging cleanup (remove backend mentions)
- Remove all "Cloudflare R2", "Supabase", "S3-compatible" copy from landing, features, footer, how-it-works, help, contact.
- Replace with neutral lines: "ultra-fast global storage", "zero-egress network", "private edge cloud".
- Delete the **How it works** route + nav link entirely.
- Trim landing sections that leak infra detail.

## 3. New pricing (replaces current pricing band)
| Plan | Storage | Price | Egress | How to get |
|------|---------|-------|--------|------------|
| Free | 1 GB | ₹0 | Free | Self sign-up |
| Plan B | 5 GB | ₹30 / month | Free | Email request |
| Custom / Enterprise | Any | Custom | Free | Email request |

Contact email everywhere: **ashishcloudservices@gmail.com**.
Free users can sign up themselves; Plan B and Custom show "Request access" → mailto link.

## 4. Invisly-style 3D redesign (landing page)
Reference: invisly.in — dark, glassy, big gradient orb / 3D blob hero, large display type, soft glow grid, sticky glass header, magnetic CTAs, scroll-reveal cards.

Implementation (no heavy 3D libs — keep bundle small):
- Animated CSS gradient mesh + radial glow orbs (blur-3xl) as hero backdrop.
- Conic-gradient rotating ring behind headline.
- Floating glass cards with subtle parallax on scroll (CSS transforms).
- Refreshed tokens in `src/styles.css`: deeper near-black bg, vivid violet→cyan gradient, neon accent, soft shadow-glow.
- Bigger display font (already have Inter Display via tokens — bump size + tracking).
- Section reveal: `animate-fade-in` on intersection.
- Sticky translucent header with backdrop-blur.

Scope: landing (`/`), header, footer. Other app pages (dashboard/admin) untouched.

## 5. Upload/download speed
- Remove artificial concurrency caps in upload flow; parallelize presign + PUT (up to 6 concurrent parts/files).
- Use `fetch` with streaming where supported; drop any throttling.
- For downloads, presigned URL already streams directly from edge — ensure no proxy step; confirm `presignDownload` returns direct URL (it does).
- Bump multipart threshold / concurrency in client uploader.

## 6. Misc polish
- Update site meta/title to drop backend references.
- robots.txt unchanged.
- Keep all auth/device-trust logic working as-is.

## Files touched (approx)
- `src/styles.css` — new tokens, gradient utilities
- `src/routes/index.tsx` — full landing redesign
- `src/components/site-header.tsx`, `site-footer.tsx` — glass + nav cleanup
- `src/routes/login.tsx`, `src/routes/invite.$token.tsx` — OTP length 8
- `src/routes/how-it-works.tsx` — delete
- `src/routes/features.tsx`, `help.tsx`, `contact.tsx` — copy cleanup, new email
- Upload component (find under dashboard) — concurrency bump

Confirm and I'll build it all in one go.

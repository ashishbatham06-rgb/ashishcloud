
# Ashish Cloud — Full Plan

A minimalist, professional light/dark cloud storage platform built on TanStack Start + Lovable Cloud (auth/DB) + Cloudflare R2 (object storage) + Lovable Email (OTP & invites).

## 1. Tech & Security Stack

- **Frontend**: TanStack Start, Tailwind v4, shadcn/ui, glass + modern card styling, smooth motion.
- **Auth/DB**: Lovable Cloud (Supabase) — RLS on every table, `user_roles` table with `app_role` enum + `has_role()` security-definer function (no role on profiles).
- **Storage**: Cloudflare R2 via AWS SDK v3 (S3-compatible) in server functions only. Presigned URLs for uploads/downloads (never expose R2 keys).
- **Email**: Lovable Email for admin OTP + invite links.
- **Security layers**:
  - RLS + role checks server-side on every server fn
  - Admin login = email + password + 6-digit email OTP (15-min expiry, rate-limited, hashed in DB)
  - Password hashing handled by Supabase Auth; HIBP leaked-password check enabled
  - Invite-only signup (signed, single-use, expiring tokens)
  - Per-user storage quota enforced server-side before presign
  - File type sniff + size cap (1 GB/file) server-side
  - Share links: signed tokens with optional expiry + password + download cap
  - Audit log table (login, upload, download, share, admin actions)
  - Rate limiting on auth + share endpoints
  - CSRF-safe server fns, httpOnly secure cookies, strict CSP headers
  - "Remember me" via long-lived refresh token (opt-in checkbox)

## 2. Database (Lovable Cloud)

Tables (all RLS-enabled, with explicit GRANTs):
- `profiles` (id → auth.users, display_name, avatar_url, storage_quota_bytes default 5 GB, storage_used_bytes, disabled bool)
- `user_roles` (user_id, role: 'admin' | 'user')
- `files` (id, owner_id, r2_key, name, size, mime, quality, folder, created_at)
- `share_links` (id, file_id, token_hash, expires_at, password_hash, max_downloads, downloads)
- `invites` (id, email, token_hash, role, quota_bytes, expires_at, used_at, created_by)
- `admin_otps` (user_id, code_hash, expires_at, attempts)
- `audit_log` (id, actor_id, action, target, meta jsonb, ip, ua, created_at)
- `billing_state` (single row: gb_month_used, class_a_ops, class_b_ops, period_start)

## 3. Pages

1. **Landing** (`/`) — hero, value props, how-it-works strip, pricing band, CTA "Request access".
2. **Features** (`/features`) — bulk upload/download, share links, quality selection, admin controls.
3. **How It Works** (`/how-it-works`) — step-by-step + diagrams.
4. **Help Center** (`/help`) — accordion FAQ + usage guide.
5. **Contact** (`/contact`) — shows ashish01raikwar@gmail.com + contact form (rate-limited).
6. **Login** (`/login`) — gmail+password; if admin → OTP step; "Remember me" checkbox.
7. **Invite accept** (`/invite/$token`) — set password, lands in dashboard.
8. **User Dashboard** (`/_authenticated/dashboard`)
   - Quota ring (used / total), drag-drop bulk uploader with quality picker (Original / High / Medium), folders, multi-select, bulk download (zip via server stream), per-file share button, preview grid for images/videos.
9. **Admin Dashboard** (`/_authenticated/admin`) — gated by `has_role('admin')`
   - **Users**: list with storage used, disable/enable, delete, edit quota, generate invite link (copy to clipboard), set role.
   - **Files**: global file browser, force-delete.
   - **Billing**: live R2 usage card with calculation:
     - Storage: `max(0, gb_month - 10) * $0.015`
     - Class A: `max(0, ops_a - 1_000_000) / 1_000_000 * $4.50`
     - Class B: `max(0, ops_b - 10_000_000) / 1_000_000 * $0.36`
     - Total estimated monthly bill, shown live, with breakdown table.
   - **Audit log** viewer with filters.

## 4. R2 Integration (server-only)

- `src/lib/r2.server.ts`: S3 client using `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
- Server fns:
  - `presignUpload({ name, size, mime, quality })` — quota check → PUT presign + Class A op counter++
  - `presignDownload({ fileId })` — ownership/share check → GET presign + Class B op counter++
  - `bulkZipDownload({ fileIds })` — streams ZIP via server route at `/api/download/zip`
  - `createShareLink`, `revokeShareLink`
  - `adminListUsers`, `adminSetQuota`, `adminDisableUser`, `adminDeleteUser`, `adminCreateInvite`
- Public share resolver at `/s/$token` (server route) — validates token, optional password, increments downloads, presigns GET.

## 5. Secrets You Will Provide

After you approve, I'll request via secrets form:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` (bucket name)
- `R2_PUBLIC_HOST` (optional custom domain; else use S3 endpoint)
- `ADMIN_SEED_EMAIL` + `ADMIN_SEED_PASSWORD` (used once to seed first admin, then auto-purged)

Lovable Email domain setup will be triggered during build (one-time DNS step at your registrar).

## 6. Build Order

1. Enable Lovable Cloud + Email domain setup dialog.
2. Migrations: enum, tables, RLS, grants, `has_role`, triggers (profile auto-create, storage usage updater).
3. Design system tokens (light/dark, glass, minimal) in `src/styles.css`.
4. Public pages (Landing, Features, How It Works, Help, Contact).
5. Auth flow: login, OTP step, invite accept, remember-me.
6. R2 server functions + presign endpoints + zip stream route.
7. User dashboard (upload/download/share).
8. Admin dashboard (users, billing, audit).
9. Audit log + rate limiting middleware.
10. Seed first admin, smoke-test end-to-end, then ask you for R2 keys.

## 7. Extra Features I'll Add (the "1–2 extras")

- **Trash / 30-day soft delete** with restore.
- **Per-file preview** (image lightbox, video player, PDF inline).

## Open Items Before Build

- Email domain: I'll trigger the Lovable Email setup dialog — you'll add 2 NS records at your domain registrar (or we can use Lovable's default sender for now and switch later).
- R2 keys: I'll request them via a secure secrets form after the scaffold is ready.

Approve and I'll start building.

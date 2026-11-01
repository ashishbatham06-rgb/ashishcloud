# Ashish Cloud — App makeover (JioCloud/Google Drive feel)

## Tasks
- [x] Remove pricing UI everywhere (landing pricing section + "See pricing", plan mentions on help/contact)
- [x] Light app-look theme refresh (clean app background, app-style radius, no fixed website gradient)
- [x] App-style authenticated shell: compact app bar + bottom tab bar (mobile), no website footer in app
- [x] Landing restyle: app-showcase hero with phone mockup (3D website hero removed)
- [x] Native plugins: @capacitor/status-bar, @capacitor/haptics, @capacitor/app + guarded init (`src/lib/native.ts`), haptics on upload/delete/tab actions
- [x] Fix head hydration warning (invalid link-tag metas moved to meta)
- [x] Verified: build OK; mobile landing + dashboard render clean (bottom tab bar present, no hydration errors)

## Deferred
- [ ] Push notifications (FCM): needs google-services.json from user to add Firebase to the Android build.
- [ ] Auto background backup (needs native plugin work + scheduling).

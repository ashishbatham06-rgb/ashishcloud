# Ashish Cloud — App makeover (JioCloud/Google Drive feel)

## Tasks
- [ ] Remove pricing UI everywhere (landing pricing section + "See pricing", plan mentions on help/contact)
- [ ] Light app-look theme refresh (clean app background, less "website" glass gradient)
- [ ] App-style authenticated shell: compact app bar + bottom tab bar (mobile), no website footer in app
- [ ] Landing hero restyle: app-showcase feel (drop heavy 3D website hero)
- [ ] Native plugins: @capacitor/status-bar, @capacitor/haptics, @capacitor/app + guarded init (`src/lib/native.ts`), haptics on key actions
- [ ] Verify build + preview (mobile viewport), no errors
- [ ] Update AGENTS.md (native init module rule)

## Notes
- Push notifications (FCM) deferred: needs google-services.json from user.
- Pricing UI only; backend billing stays.

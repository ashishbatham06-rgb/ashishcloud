# Ashish Cloud — Native App (Option A: pure native, React Native/Expo)

## Tasks
- [x] Mobile REST APIs on the web backend (/api/mobile/*, /api/upload, /api/mobile/file-url)
- [x] Native app codebase in native-app/ (Expo SDK 52): login, My Files grid, upload, download/share, backup toggle
- [x] GitHub Actions CI: .github/workflows/native-apk.yml — prebuild + assembleRelease, artifact + "native-latest" release
- [x] Fix build failure #1: invalid Java namespace `com.ashishcloud.native` → `com.ashishcloud.storage` (native-app/app.json)
- [x] Fix build failure #2: expo-asset nested/mis-resolved → added explicit `expo-asset: ~11.0.5` to native-app/package.json
- [x] Verified JS bundle locally: `npx expo export --platform android` builds clean (2.57 MB hbc)
- [ ] Wait for GitHub Actions run to finish after sync push → download `ashish-cloud-native.apk` from the "native-latest" release

## Deferred
- [ ] Push notifications (FCM): needs google-services.json from user.
- [ ] Auto background backup: current backup scans last 24h on app open; true background scheduling needs native plugin work.

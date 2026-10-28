import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ashishcloud.app',
  appName: 'Ashish Cloud',
  // The Android shell loads the published web app inside a native WebView,
  // so the full app (auth, uploads, shares) works exactly like the browser.
  webDir: 'dist',
  server: {
    url: 'https://ashishcloud.lovable.app',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;

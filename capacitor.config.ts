import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mouthband.app',
  appName: 'MouthBand',
  webDir: 'dist',
  backgroundColor: '#0e0f13',
  ios: {
    // Safe areas are handled in CSS (viewport-fit=cover + env(safe-area-inset-*)).
    contentInset: 'never',
    backgroundColor: '#0e0f13',
  },
  android: {
    // Lets `chrome://inspect` attach to debug builds only.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css', // edge-to-edge with correct env(safe-area-inset-*) values
      initialViewportFitValueHint: 'cover',
      style: 'DARK', // light status-bar icons on our dark UI
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mouthband.app',
  appName: 'HUMM',
  webDir: 'dist',
  backgroundColor: '#F6F4EF',
  ios: {
    // Safe areas are handled in CSS (viewport-fit=cover + env(safe-area-inset-*)).
    contentInset: 'never',
    backgroundColor: '#F6F4EF',
  },
  android: {
    // Lets `chrome://inspect` attach to debug builds only.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css', // edge-to-edge with correct env(safe-area-inset-*) values
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT', // dark status-bar icons on our light UI
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.krishanthasandaruwan.humm',
  appName: 'HUMM',
  webDir: 'dist',
  backgroundColor: '#F6F4EF',
  ios: {
    // Safe areas are handled in CSS (viewport-fit=cover + env(safe-area-inset-*)).
    contentInset: 'never',
    // A fixed app frame: the web view itself never scrolls or bounces; screens scroll inside.
    scrollEnabled: false,
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

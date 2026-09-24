import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dlicom.neonrun',
  appName: 'Dili: Neon Run',
  webDir: 'dist',
  backgroundColor: '#060715',
  android: {
    backgroundColor: '#060715',
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mlops.console',
  appName: 'MLOps Console',
  webDir: 'dist',
  server: {
    // For development, connect to local backend
    // In production, this would be your cloud API
    url: process.env.CAPACITOR_SERVER_URL,
    cleartext: true, // Allow HTTP for local development
  },
  plugins: {
    // SQLite for local storage
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
    // Background task for sync
    BackgroundRunner: {
      label: 'com.mlops.sync',
      src: 'runners/sync.js',
      event: 'syncData',
      repeat: true,
      interval: 15, // minutes
      autoStart: true,
    },
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'MLOps Console',
    backgroundColor: '#0a0a0f',
  },
}

export default config






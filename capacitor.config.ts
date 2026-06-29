import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.adamshugart.fitnesslog',
  appName: "Adam's Fitness",
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      presentationOptions: ['banner', 'sound'],
    },
  },
}

export default config

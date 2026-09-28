import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.muzirin.studyingal',
  appName: 'StudyInGal',
  webDir: 'dist-mobile',
  android: {
    allowMixedContent: true,
    captureInput: true,
    // 平板优先：允许横竖屏自适应，内容自己按尺寸布局
    backgroundColor: '#FFF5F9'
  },
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#FFF5F9',
      showSpinner: false
    }
  }
}

export default config

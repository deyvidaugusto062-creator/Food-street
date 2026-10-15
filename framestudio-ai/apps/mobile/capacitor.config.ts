import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Empacota o mesmo build web (apps/web/dist) como app Android/iOS.
 * Os projetos nativos são gerados com `npm run add:android` / `npm run add:ios`.
 */
const config: CapacitorConfig = {
  appId: 'ai.framestudio.app',
  appName: 'FrameStudio AI',
  webDir: '../web/dist',
  backgroundColor: '#101014',
  android: {
    // WebCodecs/WebGL2 exigem WebView moderna (Chrome 94+).
    minWebViewVersion: 110,
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
    // WebCodecs (codificação) no WKWebView exige iOS 17+.
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mypay.mypay_mobile',
  appName: 'myPay',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    FirebaseAuthentication: {
      // true → plugin retorna o credential ao JS; nós chamamos signInWithCredential
      // no Firebase Web SDK manualmente, e o onAuthStateChanged do AuthContext dispara.
      // false (default) só autentica o SDK nativo, deixando o Web SDK no escuro.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
}

export default config

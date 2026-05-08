export const isElectron = () =>
  typeof window !== 'undefined' &&
  (!!window.process?.versions?.electron ||
    /Electron/.test(navigator.userAgent))

export const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()

export const isWeb = () => !isElectron() && !isNative()

export const target = () => (isElectron() ? 'electron' : isNative() ? 'native' : 'web')

import { isNative } from '../platform'

export async function signInWithGoogle() {
  return isNative()
    ? (await import('./native.js')).signInWithGoogle()
    : (await import('./web.js')).signInWithGoogle()
}

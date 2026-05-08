import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { auth } from '../../firebase/config'

export async function signInWithGoogle() {
  const result = await FirebaseAuthentication.signInWithGoogle()
  const idToken = result?.credential?.idToken
  if (!idToken) {
    throw new Error('Native Google sign-in returned no idToken')
  }
  const credential = GoogleAuthProvider.credential(idToken)
  return signInWithCredential(auth, credential)
}

import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../../firebase/config'

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

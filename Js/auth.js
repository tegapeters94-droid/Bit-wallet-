// js/auth.js
// Real Firebase Authentication (email/password). On successful signup we
// also create the Firestore user profile and seed a simulated portfolio.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { auth, db, isFirebaseConfigured } from './firebase.js';
import { initializePortfolio } from './wallet.js';
import { setState, getState } from './state.js';

export { isFirebaseConfigured };

export async function signup({ name, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    name,
    email,
    role: 'user',
    createdAt: serverTimestamp(),
  });
  await initializePortfolio(cred.user.uid);
  return cred.user;
}

export async function login({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * initAuthListener(onReady)
 * Wires Firebase's auth state observer into the global state store, and
 * loads the matching Firestore profile whenever a user signs in. Calls
 * onReady() once, the first time auth state resolves, so app.js can kick
 * off the initial route render only after we know if someone is logged in.
 */
export function initAuthListener(onReady) {
  let firstRun = true;
  onAuthStateChanged(auth, async (user) => {
    let profile = null;
    if (user) {
      const snap = await getDoc(doc(db, 'users', user.uid));
      profile = snap.exists() ? snap.data() : null;
    }
    setState({
      user,
      profile,
      isAdmin: profile?.role === 'admin',
      authReady: true,
    });
    if (firstRun) {
      firstRun = false;
      onReady(getState());
    }
  });
}

// js/firebase.js
// Firebase is loaded from Google's CDN using the modern modular Web SDK.
// No npm install and no build step are required — this file is loaded
// directly by the browser as an ES module.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth,
  connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  getFirestore,
  connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

// ============================================================
// FIREBASE CONFIGURATION — REPLACE WITH YOUR OWN PROJECT VALUES
// ============================================================
// Get these from: Firebase Console → Project settings → General →
// Your apps → SDK setup and configuration.
// This is safe to expose in frontend code — Firebase web API keys are
// not secret; access is controlled by Firestore Security Rules
// (see firestore.rules), not by hiding this object.
const firebaseConfig = {
  apiKey: 'AIzaSyBFlUcq7PWrizQHjGnwskVAXnigDfhrg5o',
  authDomain: 'bitwallet-f664d.firebaseapp.com',
  projectId: 'bitwallet-f664d',
  storageBucket: 'bitwallet-f664d.firebasestorage.app',
  messagingSenderId: '106600949104',
  appId: '1:106600949104:web:95a19d1c3550c3772d1bb5',
};
// ============================================================

export const isFirebaseConfigured = firebaseConfig.apiKey !== 'YOUR_API_KEY';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Optional: uncomment to point at local emulators during development.
// connectAuthEmulator(auth, 'http://localhost:9099');
// connectFirestoreEmulator(db, 'localhost', 8080);

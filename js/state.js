// js/state.js
// A minimal observable store. No framework — just an object plus a set of
// listeners that get notified on every update. Views subscribe to the
// slices they care about and re-render themselves.

// Holds only auth-derived state. Portfolio/transaction data is owned by
// each view (subscribed directly from Firestore via wallet.js) rather than
// funneled through here, so balance ticks don't trigger route re-renders.
const state = {
  user: null, // Firebase Auth user object, or null
  profile: null, // Firestore users/{uid} document
  isAdmin: false,
  authReady: false, // becomes true once the first onAuthStateChanged fires
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

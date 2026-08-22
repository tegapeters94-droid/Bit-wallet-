// js/customTokens.js
// Firestore service for admin-created custom tokens. These are simulated
// tokens with no real market data — an admin sets their price and an
// optional max supply directly. Stored at the top level (not per-user)
// since a token definition is shared by everyone, not owned by one user.

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './firebase.js';
import { getUserPortfolio, listAllUsers } from './wallet.js';

const tokensCollection = () => collection(db, 'customTokens');

export function subscribeToCustomTokens(callback) {
  return onSnapshot(tokensCollection(), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/**
 * createCustomToken({ id, name, symbol, glyph, color, price, maxSupply, decimals })
 * `id` should be a short lowercase slug (e.g. "mytoken") — it becomes the
 * networkId used everywhere else in the app (portfolio keys, routes, etc).
 */
export async function createCustomToken(token) {
  await setDoc(doc(tokensCollection(), token.id), {
    name: token.name,
    symbol: token.symbol,
    glyph: token.glyph || token.symbol.slice(0, 1).toUpperCase(),
    color: token.color || '#8b6cf7',
    addressFormat: 'hex40',
    decimals: token.decimals ?? 2,
    price: token.price,
    maxSupply: token.maxSupply ?? null, // null = unlimited
    createdAt: serverTimestamp(),
  });
}

export async function updateCustomToken(id, patch) {
  await updateDoc(doc(tokensCollection(), id), patch);
}

export async function deleteCustomToken(id) {
  await deleteDoc(doc(tokensCollection(), id));
}

/**
 * getCirculatingSupply(tokenId, { excludeUid } = {})
 * Sums this token's balance across every user's portfolio. Used by the
 * admin panel to enforce a token's max supply before saving a new balance.
 * This does one Firestore read per user, so it's only used in the admin
 * flow (never in the regular authenticated app) to keep normal usage cheap.
 */
export async function getCirculatingSupply(tokenId, { excludeUid } = {}) {
  const users = await listAllUsers();
  let total = 0;
  await Promise.all(
    users
      .filter((u) => u.uid !== excludeUid)
      .map(async (u) => {
        try {
          const portfolio = await getUserPortfolio(u.uid);
          total += portfolio.assets?.[tokenId]?.balance ?? 0;
        } catch {
          // A user with an unreadable/missing portfolio just contributes 0
        }
      })
  );
  return total;
}

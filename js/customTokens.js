import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './firebase.js';
import { getUserPortfolio, listAllUsers } from './wallet.js';
const tokensCollection = () => collection(db, 'customTokens');
export function subscribeToCustomTokens(callback) {
  return onSnapshot(tokensCollection(), (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function createCustomToken(token) {
  await setDoc(doc(tokensCollection(), token.id), {
    name: token.name, symbol: token.symbol, glyph: token.glyph || token.symbol.slice(0, 1).toUpperCase(),
    color: token.color || '#8b6cf7', addressFormat: 'hex40', decimals: token.decimals ?? 2,
    logoUrl: token.logoUrl || null,
    price: token.price, maxSupply: token.maxSupply ?? null, createdAt: serverTimestamp(),
  });
}
export async function updateCustomToken(id, patch) { await updateDoc(doc(tokensCollection(), id), patch); }
export async function deleteCustomToken(id) { await deleteDoc(doc(tokensCollection(), id)); }
export async function getCirculatingSupply(tokenId, { excludeUid } = {}) {
  const users = await listAllUsers();
  let total = 0;
  await Promise.all(users.filter((u) => u.uid !== excludeUid).map(async (u) => {
    try { const portfolio = await getUserPortfolio(u.uid); total += portfolio.assets?.[tokenId]?.balance ?? 0; } catch {}
  }));
  return total;
}

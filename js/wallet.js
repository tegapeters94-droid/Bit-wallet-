// js/wallet.js
// All Firestore reads/writes for simulated portfolios and transactions.
// Every authenticated user's data lives under users/{uid}, isolated by
// Firestore Security Rules (see firestore.rules) — not by client logic.

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit as fbLimit,
  where,
  onSnapshot,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './firebase.js';
import { NETWORKS, DEFAULT_STARTING_BALANCES, getNetwork } from './networks.js';
import { generateSimulatedAddress } from './address.js';
import { createSimulatedTransaction, calculateGasFee } from './txEngine.js';

const portfolioRef = (uid) => doc(db, 'users', uid, 'wallet', 'portfolio');
const userRef = (uid) => doc(db, 'users', uid);
const txCollection = (uid) => collection(db, 'users', uid, 'transactions');

export async function initializePortfolio(uid) {
  const assets = {};
  NETWORKS.forEach((n) => {
    assets[n.id] = {
      balance: DEFAULT_STARTING_BALANCES[n.id] ?? 0,
      address: generateSimulatedAddress(n.addressFormat),
    };
  });
  await setDoc(portfolioRef(uid), { assets, updatedAt: serverTimestamp() });
  return assets;
}

export async function getUserPortfolio(uid) {
  const snap = await getDoc(portfolioRef(uid));
  if (!snap.exists()) {
    const assets = await initializePortfolio(uid);
    return { assets };
  }
  return snap.data();
}

export function subscribeToPortfolio(uid, callback) {
  return onSnapshot(portfolioRef(uid), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

export function subscribeToTransactions(uid, callback, { networkId, limitTo = 100 } = {}) {
  const constraints = [orderBy('timestamp', 'desc'), fbLimit(limitTo)];
  const q = networkId
    ? query(txCollection(uid), where('networkId', '==', networkId), ...constraints)
    : query(txCollection(uid), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), docId: d.id })));
  });
}

export async function updateAssetBalance(uid, networkId, newBalance) {
  await updateDoc(portfolioRef(uid), {
    [`assets.${networkId}.balance`]: newBalance,
    updatedAt: serverTimestamp(),
  });
}

export async function recordTransaction(uid, tx) {
  await addDoc(txCollection(uid), tx);
  return tx;
}

/**
 * simulateOutgoingPayment(uid, { networkId, amount, toAddress })
 * Deducts amount + gas fee, creates a 'sent' transaction. Throws if the
 * simulated balance can't cover amount + gas.
 */
export async function simulateOutgoingPayment(uid, { networkId, amount, toAddress }) {
  const portfolio = await getUserPortfolio(uid);
  const asset = portfolio.assets?.[networkId];
  if (!asset) throw new Error('Asset not found in portfolio.');

  const gas = calculateGasFee(networkId);
  const totalDeduction = +(amount + gas.fee).toFixed(8);
  if (totalDeduction > asset.balance) {
    throw new Error('Insufficient balance to cover amount and gas fee.');
  }

  const newBalance = +(asset.balance - totalDeduction).toFixed(8);
  await updateAssetBalance(uid, networkId, newBalance);

  const tx = createSimulatedTransaction({
    type: 'sent',
    networkId,
    amount,
    fromAddress: asset.address,
    toAddress,
    status: 'confirmed',
    gasFee: gas,
  });
  await recordTransaction(uid, tx);
  return { tx, newBalance, gas };
}

/**
 * simulateIncomingPayment(uid, { networkId, amount, fromAddress })
 * Adds a configurable amount to the balance and records a 'received' tx.
 */
export async function simulateIncomingPayment(uid, { networkId, amount, fromAddress }) {
  const portfolio = await getUserPortfolio(uid);
  const asset = portfolio.assets?.[networkId];
  if (!asset) throw new Error('Asset not found in portfolio.');

  const net = getNetwork(networkId);
  const newBalance = +(asset.balance + amount).toFixed(8);
  await updateAssetBalance(uid, networkId, newBalance);

  const tx = createSimulatedTransaction({
    type: 'received',
    networkId,
    amount,
    fromAddress: fromAddress ?? generateSimulatedAddress(net.addressFormat),
    toAddress: asset.address,
    status: 'confirmed',
  });
  await recordTransaction(uid, tx);
  return { tx, newBalance };
}

export async function resetPortfolio(uid) {
  const assets = await initializePortfolio(uid);
  const txSnap = await getDocs(txCollection(uid));
  const batch = writeBatch(db);
  txSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return assets;
}

export async function regenerateAddress(uid, networkId) {
  const net = getNetwork(networkId);
  const newAddress = generateSimulatedAddress(net.addressFormat);
  await updateDoc(portfolioRef(uid), {
    [`assets.${networkId}.address`]: newAddress,
    updatedAt: serverTimestamp(),
  });
  return newAddress;
}

export async function removeAsset(uid, networkId) {
  await updateAssetBalance(uid, networkId, 0);
}

/** Admin: set an arbitrary transaction's status */
export async function setTransactionStatus(uid, txDocId, status) {
  await updateDoc(doc(db, 'users', uid, 'transactions', txDocId), { status });
}

/** Admin: fetch a lightweight list of all users for the admin search panel */
export async function listAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function getUserProfile(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}

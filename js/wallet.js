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
import { getAssetPrice } from './pricing.js';

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

/**
 * simulatePurchase(uid, { networkId, usdAmount, feePct = 0.015 })
 * Simulates buying an asset with an external card/bank (an on-ramp) —
 * unlike Send/Receive this doesn't move value between two wallet
 * addresses, it credits the asset directly, minus a small simulated
 * processing fee taken in USD terms before conversion.
 */
export async function simulatePurchase(uid, { networkId, usdAmount, feePct = 0.015 }) {
  const { price } = getAssetPrice(networkId);
  if (!price) throw new Error('Price unavailable for this asset right now.');

  const netUsd = usdAmount * (1 - feePct);
  const tokenAmount = +(netUsd / price).toFixed(8);

  const portfolio = await getUserPortfolio(uid);
  const asset = portfolio.assets?.[networkId];
  if (!asset) throw new Error('Asset not found in portfolio.');

  const newBalance = +(asset.balance + tokenAmount).toFixed(8);
  await updateAssetBalance(uid, networkId, newBalance);

  const tx = createSimulatedTransaction({
    type: 'buy',
    networkId,
    amount: tokenAmount,
    toAddress: asset.address,
    status: 'confirmed',
  });
  await recordTransaction(uid, tx);
  return { tx, newBalance, tokenAmount };
}

/**
 * simulateSwap(uid, { fromNetworkId, toNetworkId, fromAmount, spreadPct = 0.005 })
 * Deducts fromAmount of the source asset and credits the destination
 * asset at the current simulated exchange rate, minus a small spread.
 * Both legs are recorded on a single transaction document.
 */
export async function simulateSwap(uid, { fromNetworkId, toNetworkId, fromAmount, spreadPct = 0.005 }) {
  if (fromNetworkId === toNetworkId) throw new Error('Choose two different assets to swap.');
  const fromPrice = getAssetPrice(fromNetworkId).price;
  const toPrice = getAssetPrice(toNetworkId).price;
  if (!fromPrice || !toPrice) throw new Error('Price unavailable for one of these assets right now.');

  const portfolio = await getUserPortfolio(uid);
  const fromAsset = portfolio.assets?.[fromNetworkId];
  const toAsset = portfolio.assets?.[toNetworkId];
  if (!fromAsset || !toAsset) throw new Error('Asset not found in portfolio.');
  if (fromAmount > fromAsset.balance) throw new Error('Insufficient balance for this swap.');

  const usdValue = fromAmount * fromPrice;
  const toAmount = +((usdValue * (1 - spreadPct)) / toPrice).toFixed(8);

  const newFromBalance = +(fromAsset.balance - fromAmount).toFixed(8);
  const newToBalance = +(toAsset.balance + toAmount).toFixed(8);
  await updateAssetBalance(uid, fromNetworkId, newFromBalance);
  await updateAssetBalance(uid, toNetworkId, newToBalance);

  const tx = createSimulatedTransaction({
    type: 'swap',
    networkId: fromNetworkId,
    amount: fromAmount,
    fromAddress: fromAsset.address,
    toAddress: toAsset.address,
    status: 'confirmed',
    toNetworkId,
    toAmount,
  });
  await recordTransaction(uid, tx);
  return { tx, newFromBalance, newToBalance, toAmount };
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

/**
 * setAssetAddress(uid, networkId, address)
 * Admin-only: sets a specific address for a user's asset, rather than
 * generating a random one. Used when an admin needs a user's receiving
 * address to be a known, fixed value instead of regenerating it.
 */
export async function setAssetAddress(uid, networkId, address) {
  const trimmed = address.trim();
  if (!trimmed) throw new Error('Address cannot be empty.');
  await updateDoc(portfolioRef(uid), {
    [`assets.${networkId}.address`]: trimmed,
    updatedAt: serverTimestamp(),
  });
  return trimmed;
}

/**
 * ensureAssetEntry(uid, networkId)
 * Backfills a portfolio with a fresh address + zero balance for a network
 * the user doesn't have an entry for yet — happens when a custom token is
 * created after an account already existed. Safe to call repeatedly; it
 * only writes if the entry is actually missing.
 */
export async function ensureAssetEntry(uid, networkId) {
  const portfolio = await getUserPortfolio(uid);
  if (portfolio.assets?.[networkId]) return portfolio.assets[networkId];
  const net = getNetwork(networkId);
  const address = generateSimulatedAddress(net.addressFormat);
  await updateDoc(portfolioRef(uid), {
    [`assets.${networkId}`]: { balance: 0, address },
    updatedAt: serverTimestamp(),
  });
  return { balance: 0, address };
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

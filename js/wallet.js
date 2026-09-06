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

const ACTIONS = ['send', 'swap', 'receive', 'buy'];

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

// ---------- Account restrictions (admin-managed) ----------

/**
 * getBlockedActions(uid)
 * Returns the user's current restriction map, always with all four keys
 * present (defaulting to not-blocked) so callers never need to guard
 * against a missing key.
 */
export async function getBlockedActions(uid) {
  const snap = await getDoc(userRef(uid));
  const stored = snap.exists() ? snap.data().blockedActions || {} : {};
  const result = {};
  ACTIONS.forEach((action) => {
    result[action] = {
      blocked: Boolean(stored[action]?.blocked),
      reason: stored[action]?.reason || '',
    };
  });
  return result;
}

/**
 * updateBlockedAction(uid, action, { blocked, reason })
 * Admin-only: blocks or unblocks a single wallet function (send, swap,
 * receive, buy) for one user, independently of the other three.
 *
 * Unblocking 'send' also finalizes any sends this user queued while
 * blocked (see queuePendingSend below) — their balance was already
 * deducted at the time they attempted the send, so finalizing here is
 * just a status flip from 'pending' to 'confirmed', simulating the send
 * completing now that it's allowed.
 */
export async function updateBlockedAction(uid, action, { blocked, reason }) {
  if (!ACTIONS.includes(action)) throw new Error(`Unknown action: ${action}`);
  await updateDoc(userRef(uid), {
    [`blockedActions.${action}`]: {
      blocked: Boolean(blocked),
      reason: blocked ? reason || '' : '',
      updatedAt: serverTimestamp(),
    },
  });

  if (action === 'send' && !blocked) {
    await finalizeQueuedSends(uid);
  }
}

/**
 * finalizeQueuedSends(uid)
 * Flips every send this user queued while Send was blocked from 'pending'
 * to 'confirmed'. Balances were already deducted when each was queued, so
 * no further balance change happens here.
 */
async function finalizeQueuedSends(uid) {
  const q = query(
    txCollection(uid),
    where('type', '==', 'sent'),
    where('status', '==', 'pending'),
    where('queuedWhileBlocked', '==', true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { status: 'confirmed' }));
  await batch.commit();
}

/**
 * queuePendingSend(uid, { networkId, amount, toAddress })
 * Used instead of simulateOutgoingPayment when a user's Send is currently
 * blocked but they choose to submit anyway. The amount (plus gas) is
 * deducted from their balance immediately — so it no longer shows as
 * spendable — but the transaction is recorded as 'pending' rather than
 * 'confirmed'. It only completes (flips to 'confirmed') once an admin
 * unblocks Send for this user; see finalizeQueuedSends above.
 */
export async function queuePendingSend(uid, { networkId, amount, toAddress }) {
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

  // Snapshot the reason at the moment of queuing so the notice can be
  // shown again later from the transaction itself, even if the admin's
  // reason text changes or the restriction is eventually lifted.
  const blocked = await getBlockedActions(uid);

  const tx = {
    ...createSimulatedTransaction({
      type: 'sent',
      networkId,
      amount,
      fromAddress: asset.address,
      toAddress,
      status: 'pending',
      gasFee: gas,
    }),
    queuedWhileBlocked: true,
    blockedReason: blocked.send?.reason || '',
  };
  await recordTransaction(uid, tx);
  return { tx, newBalance, gas };
}

/**
 * assertActionAllowed(uid, action)
 * Reads the user's current restriction state fresh from Firestore (not
 * from any cached client state) and throws with the admin's stated reason
 * if that action is blocked. Called at the start of every simulate*
 * function below so a restriction can never be bypassed by stale state.
 */
async function assertActionAllowed(uid, action) {
  const blocked = await getBlockedActions(uid);
  if (blocked[action]?.blocked) {
    const reason = blocked[action].reason;
    throw new Error(reason ? `This action has been restricted: ${reason}` : 'This action has been restricted on your account.');
  }
}

/**
 * simulateOutgoingPayment(uid, { networkId, amount, toAddress })
 * Deducts amount + gas fee, creates a 'sent' transaction. Throws if the
 * simulated balance can't cover amount + gas, or if Send is restricted.
 */
export async function simulateOutgoingPayment(uid, { networkId, amount, toAddress }) {
  await assertActionAllowed(uid, 'send');

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
 * Used by the admin panel to credit a user's account. Throws if Receive
 * is restricted for this user.
 */
export async function simulateIncomingPayment(uid, { networkId, amount, fromAddress }) {
  await assertActionAllowed(uid, 'receive');

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
 * Simulates buying an asset with an external card/bank. Throws if Buy is
 * restricted for this user.
 */
export async function simulatePurchase(uid, { networkId, usdAmount, feePct = 0.015 }) {
  await assertActionAllowed(uid, 'buy');

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
 * Throws if Swap is restricted for this user.
 */
export async function simulateSwap(uid, { fromNetworkId, toNetworkId, fromAmount, spreadPct = 0.005 }) {
  await assertActionAllowed(uid, 'swap');
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
 * generating a random one.
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
 * the user doesn't have an entry for yet.
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

export async function setTransactionStatus(uid, txDocId, status) {
  await updateDoc(doc(db, 'users', uid, 'transactions', txDocId), { status });
}

export async function listAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function getUserProfile(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}

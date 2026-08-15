// js/txEngine.js
// Builds simulated transaction objects and gas fees. Pure logic — no
// Firestore calls here (see wallet.js for persistence).

import { getNetwork } from './networks.js';
import { getSimulatedPrice } from './pricing.js';
import { generateSimulatedAddress, generateSimulatedTxHash } from './address.js';

// Configurable base gas values (native asset units) per network.
export const GAS_BASE = {
  ethereum: 0.0021,
  bitcoin: 0.00004,
  solana: 0.000012,
  polygon: 0.012,
  bnb: 0.0006,
  base: 0.00009,
  arbitrum: 0.00015,
};

/**
 * calculateGasFee(networkId)
 * Returns a simulated gas fee in the network's native asset, with a small
 * random variance to feel realistic across sends.
 */
export function calculateGasFee(networkId) {
  const base = GAS_BASE[networkId] ?? 0.0005;
  const variance = 0.85 + Math.random() * 0.3; // 0.85x - 1.15x
  const fee = +(base * variance).toFixed(8);
  const { price } = getSimulatedPrice(networkId);
  return { fee, usdValue: +(fee * price).toFixed(2) };
}

let txCounter = 0;
function nextTxId() {
  txCounter += 1;
  return `txn_${Date.now().toString(36)}${txCounter}`;
}

/**
 * createSimulatedTransaction(params)
 * Builds a fully-formed transaction record ready to be persisted via
 * wallet.recordTransaction().
 */
export function createSimulatedTransaction({
  type, // 'received' | 'sent' | 'gas'
  networkId,
  amount,
  fromAddress,
  toAddress,
  status = 'confirmed',
  gasFee = null,
}) {
  const net = getNetwork(networkId);
  const { price } = getSimulatedPrice(networkId);
  return {
    id: nextTxId(),
    hash: generateSimulatedTxHash(),
    type,
    asset: net?.symbol ?? '',
    networkId,
    networkName: net?.name ?? '',
    amount,
    usdValue: +(amount * price).toFixed(2),
    from: fromAddress ?? generateSimulatedAddress(net?.addressFormat ?? 'hex40'),
    to: toAddress ?? generateSimulatedAddress(net?.addressFormat ?? 'hex40'),
    gasFee: gasFee?.fee ?? null,
    gasFeeUsd: gasFee?.usdValue ?? null,
    status,
    timestamp: Date.now(),
    simulated: true,
  };
}

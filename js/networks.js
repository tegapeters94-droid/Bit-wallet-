// js/networks.js
// The network/token registry. Starts with 7 built-in chains and stays a
// single mutable array for the whole app's lifetime — admin-created custom
// tokens are pushed into (and removed from) this same array by
// customTokens.js, so every view that already does
// `import { NETWORKS, getNetwork } from './networks.js'` automatically
// picks up custom tokens with no changes to those imports.

const BUILTIN_NETWORKS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', glyph: 'Ξ', color: '#7c8cf8', addressFormat: 'hex40', decimals: 4, basePrice: 3360.5, coingeckoId: 'ethereum', builtin: true },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', glyph: '₿', color: '#f2a93b', addressFormat: 'bech32', decimals: 6, basePrice: 34666.67, coingeckoId: 'bitcoin', builtin: true },
  { id: 'solana', name: 'Solana', symbol: 'SOL', glyph: 'S', color: '#8b6cf7', addressFormat: 'base58', decimals: 3, basePrice: 166.0, coingeckoId: 'solana', builtin: true },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', glyph: 'P', color: '#a45cf0', addressFormat: 'hex40', decimals: 2, basePrice: 0.72, coingeckoId: 'matic-network', builtin: true },
  { id: 'bnb', name: 'BNB Chain', symbol: 'BNB', glyph: 'B', color: '#f0c14b', addressFormat: 'hex40', decimals: 3, basePrice: 592.3, coingeckoId: 'binancecoin', builtin: true },
  { id: 'base', name: 'Base', symbol: 'ETH', glyph: '◆', color: '#4f8cff', addressFormat: 'hex40', decimals: 4, basePrice: 3360.5, coingeckoId: 'ethereum', builtin: true },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', glyph: 'A', color: '#4bc4dd', addressFormat: 'hex40', decimals: 2, basePrice: 0.84, coingeckoId: 'arbitrum', builtin: true },
];

// The live, mutated-in-place registry. Always mutate this array with
// push/splice (never reassign `NETWORKS = ...`) so every existing import
// of this binding stays in sync automatically.
export const NETWORKS = [...BUILTIN_NETWORKS];

export function getNetwork(id) {
  return NETWORKS.find((n) => n.id === id);
}

export const DEFAULT_STARTING_BALANCES = {
  ethereum: 2.5,
  bitcoin: 0.15,
  solana: 25,
  polygon: 480,
  bnb: 3.1,
  base: 0.42,
  arbitrum: 210,
};

const listeners = new Set();

/** Views can call this to re-render when the token list changes (a custom token is added/edited/removed). */
export function onNetworksChanged(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyNetworksChanged() {
  listeners.forEach((cb) => cb());
}

/**
 * applyCustomTokens(tokens)
 * Replaces every non-builtin entry in NETWORKS with the given list, called
 * by customTokens.js whenever the Firestore custom-token collection
 * updates. Mutates NETWORKS in place.
 */
export function applyCustomTokens(tokens) {
  for (let i = NETWORKS.length - 1; i >= 0; i -= 1) {
    if (!NETWORKS[i].builtin) NETWORKS.splice(i, 1);
  }
  tokens.forEach((t) => NETWORKS.push({ ...t, builtin: false }));
  notifyNetworksChanged();
}

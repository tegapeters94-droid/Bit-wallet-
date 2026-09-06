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

export const NETWORKS = [...BUILTIN_NETWORKS];

export function getNetwork(id) {
  return NETWORKS.find((n) => n.id === id);
}

// New accounts start with zero balance on every network — addresses are
// still generated for each so Receive works immediately, but nothing is
// pre-funded. "Reset wallet" in Settings also returns a user to this state.
export const DEFAULT_STARTING_BALANCES = {
  ethereum: 0,
  bitcoin: 0,
  solana: 0,
  polygon: 0,
  bnb: 0,
  base: 0,
  arbitrum: 0,
};

const listeners = new Set();

export function onNetworksChanged(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyNetworksChanged() {
  listeners.forEach((cb) => cb());
}

export function applyCustomTokens(tokens) {
  for (let i = NETWORKS.length - 1; i >= 0; i -= 1) {
    if (!NETWORKS[i].builtin) NETWORKS.splice(i, 1);
  }
  tokens.forEach((t) => NETWORKS.push({ ...t, builtin: false }));
  notifyNetworksChanged();
}

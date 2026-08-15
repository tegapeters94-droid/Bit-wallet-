// js/networks.js
// Static configuration for each simulated network. `color` drives icon
// backgrounds and accents. `glyph` is an original monogram, not a copied
// brand logomark. `addressFormat` controls generateSimulatedAddress().

export const NETWORKS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', glyph: 'Ξ', color: '#7c8cf8', addressFormat: 'hex40', decimals: 4, basePrice: 3360.5 },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', glyph: '₿', color: '#f2a93b', addressFormat: 'bech32', decimals: 6, basePrice: 34666.67 },
  { id: 'solana', name: 'Solana', symbol: 'SOL', glyph: 'S', color: '#8b6cf7', addressFormat: 'base58', decimals: 3, basePrice: 166.0 },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', glyph: 'P', color: '#a45cf0', addressFormat: 'hex40', decimals: 2, basePrice: 0.72 },
  { id: 'bnb', name: 'BNB Chain', symbol: 'BNB', glyph: 'B', color: '#f0c14b', addressFormat: 'hex40', decimals: 3, basePrice: 592.3 },
  { id: 'base', name: 'Base', symbol: 'ETH', glyph: '◆', color: '#4f8cff', addressFormat: 'hex40', decimals: 4, basePrice: 3360.5 },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', glyph: 'A', color: '#4bc4dd', addressFormat: 'hex40', decimals: 2, basePrice: 0.84 },
];

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

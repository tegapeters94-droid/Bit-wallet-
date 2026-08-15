// js/pricing.js
// Simulated pricing engine. Prices drift slightly around each network's
// basePrice using a seeded pseudo-random walk so values feel alive across
// a session without needing a live market data feed.

import { NETWORKS, getNetwork } from './networks.js';

const priceCache = {};

function seededDrift(id) {
  const key = `${id}-${new Date().toDateString()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return (hash % 1000) / 1000; // -1 .. 1
}

export function getSimulatedPrice(networkId) {
  if (priceCache[networkId]) return priceCache[networkId];
  const net = getNetwork(networkId);
  if (!net) return { price: 0, change24h: 0 };
  const drift = seededDrift(networkId);
  const price = +(net.basePrice * (1 + drift * 0.04)).toFixed(net.basePrice < 1 ? 4 : 2);
  const change24h = +(drift * 9.5).toFixed(2);
  const result = { price, change24h };
  priceCache[networkId] = result;
  return result;
}

export function getAllSimulatedPrices() {
  return NETWORKS.reduce((acc, n) => {
    acc[n.id] = getSimulatedPrice(n.id);
    return acc;
  }, {});
}

/**
 * calculatePortfolioValue(assets)
 * assets: { [networkId]: { balance: number } }
 * Returns { total, breakdown: [{ networkId, balance, usdValue, pct, price, change24h }], change24h }
 */
export function calculatePortfolioValue(assets) {
  const prices = getAllSimulatedPrices();
  const breakdown = Object.entries(assets || {}).map(([networkId, asset]) => {
    const { price, change24h } = prices[networkId] || { price: 0, change24h: 0 };
    const usdValue = +(asset.balance * price).toFixed(2);
    return { networkId, balance: asset.balance, usdValue, price, change24h };
  });
  const total = +breakdown.reduce((sum, a) => sum + a.usdValue, 0).toFixed(2);
  const withPct = breakdown.map((a) => ({
    ...a,
    pct: total > 0 ? +((a.usdValue / total) * 100).toFixed(1) : 0,
  }));
  const weighted24h = total > 0 ? withPct.reduce((sum, a) => sum + a.change24h * (a.pct / 100), 0) : 0;
  return { total, breakdown: withPct.sort((a, b) => b.usdValue - a.usdValue), change24h: +weighted24h.toFixed(2) };
}

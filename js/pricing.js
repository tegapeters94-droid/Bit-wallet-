// js/pricing.js
// Two price sources feed every built-in network:
//   1. Live market prices from CoinGecko's public API (no key required),
//      refreshed on an interval and cached in memory.
//   2. A deterministic simulated fallback, used before the first live
//      fetch completes, if the fetch fails, or if the browser is offline.
// Custom (admin-created) tokens have no real market, so their price is
// whatever the admin set directly; only their 24h change is simulated for
// a bit of visual life.

import { NETWORKS, getNetwork } from './networks.js';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/coins/markets';
const REFRESH_INTERVAL_MS = 60000;

let livePrices = {}; // { [coingeckoId]: { price, change24h } }
let lastFetchFailed = false;
const listeners = new Set();

export function onPricesUpdated(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyPricesUpdated() {
  listeners.forEach((cb) => cb());
}

function seededDrift(id) {
  const key = `${id}-${new Date().toDateString()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return (hash % 1000) / 1000; // -1 .. 1
}

function computeSimulatedPrice(networkId, basePrice) {
  const drift = seededDrift(networkId);
  const price = +(basePrice * (1 + drift * 0.04)).toFixed(basePrice < 1 ? 4 : 2);
  const change24h = +(drift * 9.5).toFixed(2);
  return { price, change24h };
}

/**
 * getAssetPrice(networkId)
 * Synchronous — always returns immediately from whatever's cached. Live
 * prices win once available; simulated numbers fill the gap before that
 * and for custom tokens without a real market.
 */
export function getAssetPrice(networkId) {
  const net = getNetwork(networkId);
  if (!net) return { price: 0, change24h: 0 };

  if (net.builtin) {
    const live = livePrices[net.coingeckoId];
    if (live) return live;
    return computeSimulatedPrice(networkId, net.basePrice);
  }

  // Custom token: price is admin-set and authoritative; only the 24h
  // change is simulated since there's no real market to read it from.
  const { change24h } = computeSimulatedPrice(networkId, net.price || 1);
  return { price: net.price ?? 0, change24h };
}

export function getAllAssetPrices() {
  return NETWORKS.reduce((acc, n) => {
    acc[n.id] = getAssetPrice(n.id);
    return acc;
  }, {});
}

/**
 * refreshLivePrices()
 * Fetches current USD prices + 24h change for every built-in network's
 * CoinGecko id in a single request. Silently keeps the previous cache on
 * failure (offline, rate-limited, CORS issue, etc) — the app always falls
 * back to simulated numbers rather than breaking.
 */
export async function refreshLivePrices() {
  const ids = [...new Set(NETWORKS.filter((n) => n.builtin).map((n) => n.coingeckoId))];
  if (ids.length === 0) return;

  try {
    const url = `${COINGECKO_URL}?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=24h`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
    const data = await res.json();

    const next = {};
    data.forEach((coin) => {
      if (typeof coin.current_price === 'number') {
        next[coin.id] = {
          price: coin.current_price,
          change24h: +(coin.price_change_percentage_24h ?? 0).toFixed(2),
        };
      }
      // Real logo, straight from CoinGecko — applied to every network that
      // shares this coingeckoId (e.g. Base and Ethereum both use ETH's logo).
      if (coin.image) {
        NETWORKS.filter((n) => n.builtin && n.coingeckoId === coin.id).forEach((n) => {
          n.logoUrl = coin.image;
        });
      }
    });
    if (Object.keys(next).length > 0) {
      livePrices = { ...livePrices, ...next };
      lastFetchFailed = false;
      notifyPricesUpdated();
    }
  } catch (err) {
    lastFetchFailed = true;
    console.warn('Live price refresh failed, using simulated prices instead:', err.message);
  }
}

export function isUsingLivePrices() {
  return Object.keys(livePrices).length > 0 && !lastFetchFailed;
}

/**
 * startLivePricePolling()
 * Fetches immediately, then on a fixed interval for the lifetime of the
 * page. Call once from app.js.
 */
export function startLivePricePolling() {
  refreshLivePrices();
  setInterval(refreshLivePrices, REFRESH_INTERVAL_MS);
}

/**
 * calculatePortfolioValue(assets)
 * assets: { [networkId]: { balance: number } }
 */
export function calculatePortfolioValue(assets) {
  const breakdown = Object.entries(assets || {}).map(([networkId, asset]) => {
    const { price, change24h } = getAssetPrice(networkId);
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

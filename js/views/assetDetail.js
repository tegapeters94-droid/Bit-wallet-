// js/views/assetDetail.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, subscribeToTransactions, ensureAssetEntry } from '../wallet.js';
import { getNetwork } from '../networks.js';
import { calculatePortfolioValue, onPricesUpdated } from '../pricing.js';
import { renderPortfolioChart, CHART_RANGES } from '../chart.js';
import { renderQrInto } from '../qr.js';
import { notify } from '../toast.js';
import {
  networkIconHtml,
  transactionGroupsHtml,
  emptyStateHtml,
  copyButtonHtml,
  wireCopyButtons,
  formatUsd,
  mountRangeFilters,
} from '../components.js';

export function mount(container, params) {
  const content = renderShell(container);
  const { user } = getState();
  const { networkId } = params;
  const net = getNetwork(networkId);
  let range = '1D';

  if (!net) {
    content.innerHTML = emptyStateHtml({ icon: '✕', title: 'Unknown network', message: "That asset doesn't exist." });
    return;
  }

  content.innerHTML = `<div class="card">Loading asset…</div>`;

  let latestAssets = null;
  let latestTx = [];

  function render() {
    const assetData = latestAssets?.[networkId];
    if (!assetData) {
      // A token created after this account already existed won't have an
      // entry yet — backfill one, then re-render once the snapshot updates.
      if (latestAssets) ensureAssetEntry(user.uid, networkId).catch(() => {});
      return;
    }

    const visible = Object.fromEntries(Object.entries(latestAssets).filter(([, a]) => a.balance > 0));
    const portfolio = calculatePortfolioValue(visible);
    const breakdown = portfolio.breakdown.find((a) => a.networkId === networkId);
    const price = breakdown?.price ?? 0;
    const change24h = breakdown?.change24h ?? 0;
    const usdValue = breakdown?.usdValue ?? assetData.balance * price;
    const positive = change24h >= 0;
    const assetTx = latestTx.filter((t) => t.networkId === networkId);

    content.innerHTML = `
      <a href="#/assets" class="back-link">← Back</a>

      <div class="asset-hero">
        <div class="asset-hero__top">
          ${networkIconHtml(net.id, 44)}
          <div>
            <h1>${net.name}</h1>
            <span class="page-eyebrow">${net.symbol}</span>
          </div>
        </div>

        <div class="asset-hero__price">
          <div class="asset-hero__price-figure">$${price.toLocaleString()}</div>
          <div class="asset-hero__change ${positive ? 'is-up' : 'is-down'}">${positive ? '+' : ''}${change24h}%</div>
        </div>

        <div class="asset-hero__balance">
          <span>${assetData.balance.toLocaleString(undefined, { maximumFractionDigits: net.decimals })} ${net.symbol}</span>
          <span class="asset-hero__balance-usd">${formatUsd(usdValue)}</span>
        </div>

        <div class="quick-actions quick-actions--compact">
          <a href="#/send" class="btn btn--primary">Send</a>
          <a href="#/receive" class="btn btn--secondary">Receive</a>
        </div>
      </div>

      <div class="card">
        <div class="portfolio-card__chart"><canvas id="assetCanvas"></canvas></div>
        <div id="rangeFilters"></div>
      </div>

      <div class="card">
        <span class="page-eyebrow">Wallet address</span>
        <div class="asset-detail__address">
          <span class="mono" id="addrText">${assetData.address}</span>
          ${copyButtonHtml('addrText')}
        </div>
      </div>

      <div class="card" style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <canvas id="qrCanvas"></canvas>
        <span class="page-eyebrow">Scan to view address</span>
      </div>

      <section class="section-block">
        <div class="section-head"><h3>Activity</h3></div>
        <div id="txListDetail">
          ${
            assetTx.length === 0
              ? emptyStateHtml({ icon: '☰', title: 'No activity yet', message: `Sends and receives on ${net.name} will appear here.` })
              : transactionGroupsHtml(assetTx)
          }
        </div>
      </section>
    `;

    const canvas = content.querySelector('#assetCanvas');
    requestAnimationFrame(() => renderPortfolioChart(canvas, price, change24h, range));
    mountRangeFilters(content.querySelector('#rangeFilters'), CHART_RANGES, range, (r) => {
      range = r;
      render();
    });

    wireCopyButtons(content, { onCopied: () => notify('Address copied') });
    renderQrInto(content.querySelector('#qrCanvas'), assetData.address);
  }

  const unsubPortfolio = subscribeToPortfolio(user.uid, (data) => {
    latestAssets = data.assets || {};
    render();
  });
  const unsubTx = subscribeToTransactions(user.uid, (tx) => {
    latestTx = tx;
    render();
  });
  const unsubPrices = onPricesUpdated(render);

  return () => {
    unsubPortfolio();
    unsubTx();
    unsubPrices();
  };
}

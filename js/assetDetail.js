// js/views/assetDetail.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, subscribeToTransactions } from '../wallet.js';
import { getNetwork } from '../networks.js';
import { calculatePortfolioValue } from '../pricing.js';
import { renderQrInto } from '../qr.js';
import { notify } from '../toast.js';
import {
  networkIconHtml,
  transactionRowHtml,
  emptyStateHtml,
  copyButtonHtml,
  wireCopyButtons,
  formatUsd,
} from '../components.js';

export function mount(container, params) {
  const content = renderShell(container);
  const { user } = getState();
  const { networkId } = params;
  const net = getNetwork(networkId);

  if (!net) {
    content.innerHTML = emptyStateHtml({ icon: '✕', title: 'Unknown network', message: "That asset doesn't exist." });
    return;
  }

  content.innerHTML = `<div class="glass-card">Loading asset…</div>`;

  let latestAssets = null;
  let latestTx = [];

  function render() {
    const assetData = latestAssets?.[networkId];
    if (!assetData) return;

    const visible = Object.fromEntries(Object.entries(latestAssets).filter(([, a]) => a.balance > 0));
    const portfolio = calculatePortfolioValue(visible);
    const breakdown = portfolio.breakdown.find((a) => a.networkId === networkId);
    const price = breakdown?.price ?? 0;
    const change24h = breakdown?.change24h ?? 0;
    const usdValue = breakdown?.usdValue ?? assetData.balance * price;
    const assetTx = latestTx.filter((t) => t.networkId === networkId);

    content.innerHTML = `
      <a href="#/assets" class="back-link">← Back</a>

      <div class="page-header">
        <div class="asset-detail__title">
          ${networkIconHtml(net.id, 48)}
          <div><h1>${net.name}</h1><span class="page-eyebrow">${net.symbol}</span></div>
        </div>
        <div class="page-header__actions">
          <a href="#/send" class="btn btn--primary">Send</a>
          <a href="#/receive" class="btn btn--ghost">Receive</a>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="glass-card">
          <span class="page-eyebrow">Balance</span>
          <div class="asset-detail__balance">${assetData.balance.toLocaleString(undefined, { maximumFractionDigits: net.decimals })} ${net.symbol}</div>
          <div class="asset-detail__usd">${formatUsd(usdValue)}</div>
          <div class="hero-balance__change ${change24h >= 0 ? 'is-up' : 'is-down'}">${change24h >= 0 ? '▲' : '▼'} ${Math.abs(change24h)}% (24h, simulated)</div>

          <div class="asset-detail__divider"></div>

          <span class="page-eyebrow">Wallet address</span>
          <div class="asset-detail__address">
            <span class="mono" id="addrText">${assetData.address}</span>
            ${copyButtonHtml('addrText')}
          </div>

          <div class="asset-detail__network-info">
            <div><span>Network</span><strong>${net.name}</strong></div>
            <div><span>Symbol</span><strong>${net.symbol}</strong></div>
            <div><span>Simulated price</span><strong>$${price.toLocaleString()}</strong></div>
          </div>
        </div>

        <div class="glass-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;">
          <div class="qr-frame"><canvas id="qrCanvas"></canvas></div>
          <span class="page-eyebrow">Scan to view address</span>
        </div>
      </div>

      <section class="glass-card">
        <div class="section-head"><h3>Transaction history</h3></div>
        <div id="txListDetail">
          ${
            assetTx.length === 0
              ? emptyStateHtml({ icon: '☰', title: 'No transactions yet', message: `Sends and receives on ${net.name} will appear here.` })
              : `<div class="tx-list">${assetTx.map(transactionRowHtml).join('')}</div>`
          }
        </div>
      </section>
    `;

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

  return () => {
    unsubPortfolio();
    unsubTx();
  };
}

// js/views/assets.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio } from '../wallet.js';
import { calculatePortfolioValue, onPricesUpdated } from '../pricing.js';
import { assetRowHtml, emptyStateHtml, skeletonCardHtml, mountNetworkSwitcher, formatUsd } from '../components.js';

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();
  let selectedNetwork = 'all';
  let latestAssets = null;

  content.innerHTML = `
    <div class="page-header">
      <h1>Assets</h1>
      <div id="networkSwitcher"></div>
    </div>
    <div class="card" id="totalCard">${skeletonCardHtml()}</div>
    <div id="assetsList">${skeletonCardHtml()}${skeletonCardHtml()}${skeletonCardHtml()}${skeletonCardHtml()}</div>
  `;

  function renderSwitcher() {
    mountNetworkSwitcher(content.querySelector('#networkSwitcher'), selectedNetwork, (val) => {
      selectedNetwork = val;
      renderSwitcher();
      renderList();
    });
  }

  function renderList() {
    const totalCard = content.querySelector('#totalCard');
    const listEl = content.querySelector('#assetsList');
    if (!latestAssets) return;
    const visible = Object.fromEntries(Object.entries(latestAssets).filter(([, a]) => a.balance > 0));
    const portfolio = calculatePortfolioValue(visible);
    const filtered =
      selectedNetwork === 'all' ? portfolio.breakdown : portfolio.breakdown.filter((a) => a.networkId === selectedNetwork);

    totalCard.innerHTML = `
      <span class="portfolio-card__label">${selectedNetwork === 'all' ? 'Total assets value' : 'Value'}</span>
      <div class="asset-hero__price-figure" style="margin-top:6px;">${formatUsd(filtered.reduce((s, a) => s + a.usdValue, 0))}</div>
    `;

    if (filtered.length === 0) {
      listEl.innerHTML = emptyStateHtml({
        icon: '◈',
        title: 'No assets here',
        message: 'Try a different network, or receive a payment.',
      });
    } else {
      listEl.innerHTML = `<div class="asset-list">${filtered.map(assetRowHtml).join('')}</div>`;
    }
  }

  renderSwitcher();

  const unsub = subscribeToPortfolio(user.uid, (data) => {
    latestAssets = data.assets || {};
    renderList();
  });
  const unsubPrices = onPricesUpdated(renderList);

  return () => {
    unsub();
    unsubPrices();
  };
}

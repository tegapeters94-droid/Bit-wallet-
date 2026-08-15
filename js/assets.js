// js/views/assets.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio } from '../wallet.js';
import { calculatePortfolioValue } from '../pricing.js';
import { assetRowHtml, emptyStateHtml, skeletonCardHtml, mountNetworkSwitcher } from '../components.js';

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();
  let selectedNetwork = 'all';
  let latestAssets = null;

  content.innerHTML = `
    <div class="page-header">
      <div><span class="page-eyebrow">Portfolio</span><h1>Assets</h1></div>
      <div id="networkSwitcher"></div>
    </div>
    <section class="glass-card">
      <div id="assetsList">${skeletonCardHtml()}${skeletonCardHtml()}${skeletonCardHtml()}${skeletonCardHtml()}</div>
    </section>
  `;

  function renderSwitcher() {
    mountNetworkSwitcher(content.querySelector('#networkSwitcher'), selectedNetwork, (val) => {
      selectedNetwork = val;
      renderSwitcher();
      renderList();
    });
  }

  function renderList() {
    const listEl = content.querySelector('#assetsList');
    if (!latestAssets) return;
    const visible = Object.fromEntries(Object.entries(latestAssets).filter(([, a]) => a.balance > 0));
    const portfolio = calculatePortfolioValue(visible);
    const filtered =
      selectedNetwork === 'all' ? portfolio.breakdown : portfolio.breakdown.filter((a) => a.networkId === selectedNetwork);

    if (filtered.length === 0) {
      listEl.innerHTML = emptyStateHtml({
        icon: '◈',
        title: 'No assets here',
        message: 'Try a different network, or receive a simulated payment.',
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

  return () => unsub();
}

// js/views/dashboard.js
import { getState } from '../state.js';
import { renderShell, escapeHtml } from '../shell.js';
import { subscribeToPortfolio, subscribeToTransactions } from '../wallet.js';
import { calculatePortfolioValue } from '../pricing.js';
import { renderPortfolioChart } from '../chart.js';
import { assetRowHtml, transactionRowHtml, emptyStateHtml, skeletonCardHtml, formatUsd } from '../components.js';

export function mount(container) {
  const content = renderShell(container);
  const { profile, user } = getState();
  const firstName = (profile?.name || 'there').split(' ')[0];

  content.innerHTML = `
    <div class="page-header">
      <div>
        <span class="page-eyebrow">Welcome back</span>
        <h1>${escapeHtml(firstName)}'s wallet</h1>
      </div>
      <div class="page-header__actions">
        <a href="#/send" class="btn btn--primary">Send</a>
        <a href="#/receive" class="btn btn--ghost">Receive</a>
      </div>
    </div>

    <div class="glass-card glass-card--hero" id="heroCard">${skeletonCardHtml()}</div>

    <div class="dashboard-grid">
      <section class="glass-card">
        <div class="section-head"><h3>Assets</h3><a href="#/assets" class="link-more">View all</a></div>
        <div id="assetsList">${skeletonCardHtml()}${skeletonCardHtml()}${skeletonCardHtml()}</div>
      </section>

      <section class="glass-card">
        <div class="section-head"><h3>Recent activity</h3><a href="#/activity" class="link-more">View all</a></div>
        <div id="txList">${skeletonCardHtml()}${skeletonCardHtml()}</div>
      </section>
    </div>
  `;

  let latestAssets = null;
  let latestTx = [];

  function renderHero() {
    if (!latestAssets) return;
    const visible = Object.fromEntries(Object.entries(latestAssets).filter(([, a]) => a.balance > 0));
    const portfolio = calculatePortfolioValue(visible);
    const positive = portfolio.change24h >= 0;

    const heroCard = content.querySelector('#heroCard');
    heroCard.innerHTML = `
      <div class="hero-balance">
        <span class="page-eyebrow">Total balance</span>
        <div class="hero-balance__figure"><span class="hero-balance__pulse"></span>${formatUsd(portfolio.total)}</div>
        <div class="hero-balance__change ${positive ? 'is-up' : 'is-down'}">${positive ? '▲' : '▼'} ${Math.abs(portfolio.change24h)}% · last 24h (simulated)</div>
      </div>
      <div class="portfolio-chart"><canvas id="portfolioCanvas"></canvas></div>
    `;
    const canvas = heroCard.querySelector('#portfolioCanvas');
    requestAnimationFrame(() => renderPortfolioChart(canvas, portfolio.total, portfolio.change24h));

    const assetsList = content.querySelector('#assetsList');
    if (portfolio.breakdown.length === 0) {
      assetsList.innerHTML = emptyStateHtml({
        icon: '◈',
        title: 'No assets yet',
        message: 'Simulate an incoming payment to see your portfolio come to life.',
        actionHtml: `<a href="#/receive" class="btn btn--primary">Receive funds</a>`,
      });
    } else {
      assetsList.innerHTML = `<div class="asset-list">${portfolio.breakdown.slice(0, 5).map(assetRowHtml).join('')}</div>`;
    }
  }

  function renderTx() {
    const txList = content.querySelector('#txList');
    const recent = latestTx.slice(0, 5);
    if (recent.length === 0) {
      txList.innerHTML = emptyStateHtml({
        icon: '☰',
        title: 'No transactions yet',
        message: 'Your sends, receives, and gas fees will show up here.',
      });
    } else {
      txList.innerHTML = `<div class="tx-list">${recent.map(transactionRowHtml).join('')}</div>`;
    }
  }

  const unsubPortfolio = subscribeToPortfolio(user.uid, (data) => {
    latestAssets = data.assets || {};
    renderHero();
  });
  const unsubTx = subscribeToTransactions(user.uid, (tx) => {
    latestTx = tx;
    renderTx();
  });

  window.addEventListener('resize', renderHero);

  return () => {
    unsubPortfolio();
    unsubTx();
    window.removeEventListener('resize', renderHero);
  };
}

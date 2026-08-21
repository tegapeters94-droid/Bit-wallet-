// js/views/dashboard.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, subscribeToTransactions } from '../wallet.js';
import { calculatePortfolioValue } from '../pricing.js';
import { renderPortfolioChart, CHART_RANGES } from '../chart.js';
import {
  assetRowHtml,
  transactionRowHtml,
  emptyStateHtml,
  skeletonCardHtml,
  formatUsd,
  quickActionHtml,
  QUICK_ACTION_ICONS,
  mountRangeFilters,
} from '../components.js';

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();
  let range = '1D';

  content.innerHTML = `
    <div class="portfolio-card" id="portfolioCard">${skeletonCardHtml()}</div>

    <div class="quick-actions">
      ${quickActionHtml({ href: '#/receive', icon: QUICK_ACTION_ICONS.receive, label: 'Receive' })}
      ${quickActionHtml({ href: '#/send', icon: QUICK_ACTION_ICONS.send, label: 'Send' })}
    </div>

    <section class="section-block">
      <div class="section-head"><h3>Assets</h3><a href="#/assets" class="link-more">View all</a></div>
      <div id="assetsList">${skeletonCardHtml()}${skeletonCardHtml()}${skeletonCardHtml()}</div>
    </section>

    <section class="section-block">
      <div class="section-head"><h3>Recent activity</h3><a href="#/activity" class="link-more">View all</a></div>
      <div id="txList">${skeletonCardHtml()}${skeletonCardHtml()}</div>
    </section>
  `;

  let latestAssets = null;
  let latestTx = [];

  function renderPortfolio() {
    if (!latestAssets) return;
    const visible = Object.fromEntries(Object.entries(latestAssets).filter(([, a]) => a.balance > 0));
    const portfolio = calculatePortfolioValue(visible);
    const positive = portfolio.change24h >= 0;
    const changeUsd = +(portfolio.total * (portfolio.change24h / 100)).toFixed(2);

    const card = content.querySelector('#portfolioCard');
    card.innerHTML = `
      <div class="portfolio-card__balance">
        <span class="portfolio-card__label">Total balance</span>
        <div class="portfolio-card__figure">${formatUsd(portfolio.total)}</div>
        <div class="portfolio-card__change ${positive ? 'is-up' : 'is-down'}">
          ${positive ? '+' : ''}${formatUsd(Math.abs(changeUsd))} · ${positive ? '+' : ''}${portfolio.change24h}%
        </div>
      </div>
      <div class="portfolio-card__chart"><canvas id="portfolioCanvas"></canvas></div>
      <div id="rangeFilters"></div>
    `;

    const canvas = card.querySelector('#portfolioCanvas');
    requestAnimationFrame(() => renderPortfolioChart(canvas, portfolio.total, portfolio.change24h, range));
    mountRangeFilters(card.querySelector('#rangeFilters'), CHART_RANGES, range, (r) => {
      range = r;
      renderPortfolio();
    });

    const assetsList = content.querySelector('#assetsList');
    if (portfolio.breakdown.length === 0) {
      assetsList.innerHTML = emptyStateHtml({
        icon: '◈',
        title: 'No assets yet',
        message: 'Receive a payment to see your portfolio come to life.',
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
        title: 'No activity yet',
        message: 'Your sends, receives, and network fees will show up here.',
      });
    } else {
      txList.innerHTML = `<div class="tx-list">${recent.map(transactionRowHtml).join('')}</div>`;
    }
  }

  const unsubPortfolio = subscribeToPortfolio(user.uid, (data) => {
    latestAssets = data.assets || {};
    renderPortfolio();
  });
  const unsubTx = subscribeToTransactions(user.uid, (tx) => {
    latestTx = tx;
    renderTx();
  });

  window.addEventListener('resize', renderPortfolio);

  return () => {
    unsubPortfolio();
    unsubTx();
    window.removeEventListener('resize', renderPortfolio);
  };
}

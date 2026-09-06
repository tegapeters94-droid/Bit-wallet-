// js/views/dashboard.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, subscribeToTransactions, getUserPortfolio } from '../wallet.js';
import { calculatePortfolioValue, onPricesUpdated } from '../pricing.js';
import { shortenAddress } from '../address.js';
import { notify } from '../toast.js';
import {
  assetRowHtml,
  transactionRowHtml,
  emptyStateHtml,
  skeletonCardHtml,
  formatUsd,
  quickActionHtml,
  QUICK_ACTION_ICONS,
  wireCopyButtons,
  eyeIconHtml,
  wirePendingNoticeRows,
} from '../components.js';

const HIDE_BALANCE_KEY = 'bitwallet_balance_hidden';

export function mount(container) {
  const content = renderShell(container);
  const { user, profile } = getState();
  const firstName = (profile?.name || 'My').split(' ')[0];
  let balanceHidden = window.localStorage.getItem(HIDE_BALANCE_KEY) === '1';
  let primaryAddress = '';

  content.innerHTML = `
    <div class="balance-card" id="balanceCard">${skeletonCardHtml()}</div>

    <div class="quick-actions">
      ${quickActionHtml({ href: '#/receive', icon: QUICK_ACTION_ICONS.receive, label: 'Receive' })}
      ${quickActionHtml({ href: '#/buy', icon: QUICK_ACTION_ICONS.buy, label: 'Buy' })}
      ${quickActionHtml({ href: '#/swap', icon: QUICK_ACTION_ICONS.swap, label: 'Swap' })}
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

  function renderBalanceCard() {
    if (!latestAssets) return;
    const visible = Object.fromEntries(Object.entries(latestAssets).filter(([, a]) => a.balance > 0));
    const portfolio = calculatePortfolioValue(visible);
    const positive = portfolio.change24h >= 0;
    const changeUsd = +(portfolio.total * (portfolio.change24h / 100)).toFixed(2);

    const balanceDisplay = balanceHidden ? '$••••••' : formatUsd(portfolio.total);
    const changeDisplay = balanceHidden
      ? `${positive ? '+' : ''}${portfolio.change24h}% today`
      : `${positive ? '+' : ''}${formatUsd(Math.abs(changeUsd))} · ${positive ? '+' : ''}${portfolio.change24h}% today`;

    const card = content.querySelector('#balanceCard');
    card.innerHTML = `
      <div class="balance-card__identity">
        <span class="balance-card__name">${firstName}'s Wallet</span>
        ${
          primaryAddress
            ? `<span class="balance-card__address mono" id="dashAddrText">${shortenAddress(primaryAddress, 4)}</span>
               <button class="copy-btn copy-btn--tiny" data-copy-target="dashAddrText" data-copy-text="${primaryAddress}" type="button">${copyIconHtml()}</button>`
            : ''
        }
      </div>

      <div class="balance-card__row">
        <span class="balance-card__label">Total balance</span>
        <button class="eye-btn" id="eyeToggle" aria-label="${balanceHidden ? 'Show balance' : 'Hide balance'}" aria-pressed="${balanceHidden}">
          ${eyeIconHtml(balanceHidden)}
        </button>
      </div>
      <div class="balance-card__figure ${balanceHidden ? 'is-hidden' : ''}">${balanceDisplay}</div>
      <div class="balance-card__change ${positive ? 'is-up' : 'is-down'}">${changeDisplay}</div>
    `;

    card.querySelector('#eyeToggle').addEventListener('click', () => {
      balanceHidden = !balanceHidden;
      window.localStorage.setItem(HIDE_BALANCE_KEY, balanceHidden ? '1' : '0');
      renderBalanceCard();
    });
    wireCopyButtons(card, { onCopied: () => notify('Address copied') });

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
      wirePendingNoticeRows(txList, recent);
    }
  }

  getUserPortfolio(user.uid).then((p) => {
    primaryAddress = p.assets?.ethereum?.address || '';
    renderBalanceCard();
  });

  const unsubPortfolio = subscribeToPortfolio(user.uid, (data) => {
    latestAssets = data.assets || {};
    renderBalanceCard();
  });
  const unsubTx = subscribeToTransactions(user.uid, (tx) => {
    latestTx = tx;
    renderTx();
  });
  const unsubPrices = onPricesUpdated(renderBalanceCard);

  return () => {
    unsubPortfolio();
    unsubTx();
    unsubPrices();
  };
}

function copyIconHtml() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="2"/></svg>`;
}

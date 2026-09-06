// js/views/landing.js
import { NETWORKS } from '../networks.js';
import { networkIconHtml, quickActionHtml, QUICK_ACTION_ICONS, eyeIconHtml } from '../components.js';

// Illustrative figures for the product preview only — this is an
// unauthenticated marketing page, so there's no real account/session to
// read balances from. Nothing here is wired to Firestore or auth.
const PREVIEW_ASSETS = [
  { id: 'ethereum', balance: '0.65 ETH', usd: '$1,622.46', change: '+2.91%', up: true },
  { id: 'bitcoin', balance: '0.02 BTC', usd: '$693.33', change: '-1.14%', up: false },
  { id: 'solana', balance: '4.2 SOL', usd: '$697.20', change: '+5.10%', up: true },
  { id: 'bnb', balance: '1.1 BNB', usd: '$651.53', change: '+0.42%', up: true },
];

export function mount(container) {
  container.innerHTML = `
    <div class="landing">
      <header class="landing__nav">
        <div class="landing__brand">
          <span class="shell__brand-mark">B</span>
          Bitwallet
        </div>
        <a href="#/signup" class="btn btn--ghost btn--sm">Create wallet</a>
      </header>

      <section class="landing__hero">
        <span class="landing__eyebrow">Multi-chain wallet</span>
        <h1>
          One wallet.<br />
          <span class="text-gradient">Seven chains.</span><br />
          All yours.
        </h1>
        <p class="landing__sub">
          Manage your crypto across Ethereum, Bitcoin, Solana and more — from one beautifully simple wallet.
        </p>
        <div class="landing__hero-actions">
          <a href="#/signup" class="btn btn--primary btn--lg">Create wallet</a>
          <a href="#/login" class="btn btn--ghost btn--lg">I already have a wallet</a>
        </div>

        <div class="wallet-preview-wrap">
          <div class="wallet-preview">
            <div class="balance-card">
              <div class="balance-card__identity">
                <span class="balance-card__name">James's Wallet</span>
                <span class="balance-card__address mono">0x0ec3…2ae7</span>
                <span class="copy-btn copy-btn--tiny">${copyIconHtml()}</span>
              </div>
              <div class="balance-card__row">
                <span class="balance-card__label">Total balance</span>
                <span class="eye-btn">${eyeIconHtml(false)}</span>
              </div>
              <div class="balance-card__figure">$3,305.31</div>
              <div class="balance-card__change is-up">+$73.05 · +2.21% today</div>
            </div>

            <div class="quick-actions">
              ${quickActionHtml({ href: '#', icon: QUICK_ACTION_ICONS.receive, label: 'Receive' })}
              ${quickActionHtml({ href: '#', icon: QUICK_ACTION_ICONS.buy, label: 'Buy' })}
              ${quickActionHtml({ href: '#', icon: QUICK_ACTION_ICONS.swap, label: 'Swap' })}
              ${quickActionHtml({ href: '#', icon: QUICK_ACTION_ICONS.send, label: 'Send' })}
            </div>

            <div class="section-head"><h3>Assets</h3><span class="link-more">View all</span></div>
            <div class="asset-list">
              ${PREVIEW_ASSETS.map(
                (a) => `
                <div class="asset-row">
                  ${networkIconHtml(a.id, 36)}
                  <div class="asset-row__main">
                    <div class="asset-row__name">${networkName(a.id)}</div>
                    <div class="asset-row__sub">${a.balance}</div>
                  </div>
                  <div class="asset-row__value">
                    <div class="asset-row__usd">${a.usd}</div>
                    <div class="asset-row__change ${a.up ? 'is-up' : 'is-down'}">${a.change}</div>
                  </div>
                </div>`
              ).join('')}
            </div>
          </div>
          <div class="wallet-preview-fade"></div>
        </div>
      </section>

      <section class="landing__networks-section">
        <h2 class="landing__networks-heading">One wallet. Seven networks.</h2>
        <div class="landing__network-grid">
          ${NETWORKS.map(
            (n, i) => `
            <div class="landing__network-item ${NETWORKS.length % 2 === 1 && i === NETWORKS.length - 1 ? 'landing__network-item--full' : ''}">
              ${networkIconHtml(n.id, 28)}
              <span>${n.name}</span>
            </div>`
          ).join('')}
        </div>
      </section>

      <footer class="landing__footer">
        <span>© 2026 Bitwallet</span>
      </footer>
    </div>
  `;
}

function networkName(id) {
  const map = { ethereum: 'Ethereum', bitcoin: 'Bitcoin', solana: 'Solana', bnb: 'BNB Chain' };
  return map[id] || id;
}

function copyIconHtml() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="2"/></svg>`;
}

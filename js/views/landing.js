// js/views/landing.js
import { NETWORKS } from '../networks.js';
import { networkIconHtml } from '../components.js';

export function mount(container) {
  container.innerHTML = `
    <div class="landing">
      <header class="landing__nav">
        <div class="landing__brand">
          <span class="shell__brand-mark">B</span>
          Bitwallet
        </div>
        <div class="landing__nav-actions">
          <a href="#/login" class="btn btn--ghost">Log in</a>
          <a href="#/signup" class="btn btn--primary">Create wallet</a>
        </div>
      </header>

      <section class="landing__hero">
        <h1>
          One wallet, <span class="text-gradient">seven chains</span>,
          <br />
          entirely yours.
        </h1>
        <p class="landing__sub">
          Manage Ethereum, Bitcoin, Solana, and more from one clean, fast wallet —
          balances, activity, sends and receives, all in one place.
        </p>
        <div class="landing__hero-actions">
          <a href="#/signup" class="btn btn--primary btn--lg">Create wallet</a>
          <a href="#/login" class="btn btn--ghost btn--lg">I already have a wallet</a>
        </div>

        <div class="landing__networks">
          ${NETWORKS.map((n) => `<div class="landing__network-chip">${networkIconHtml(n.id, 28)}<span>${n.name}</span></div>`).join('')}
        </div>
      </section>

      <section class="landing__features">
        <div class="card">
          <div class="landing__feature-icon">◈</div>
          <h3>Multi-chain by default</h3>
          <p>Ethereum, Bitcoin, Solana, Polygon, BNB Chain, Base, and Arbitrum in a single portfolio view.</p>
        </div>
        <div class="card">
          <div class="landing__feature-icon">↻</div>
          <h3>Living transaction history</h3>
          <p>Send and receive flows generate real-feeling transactions, network fees, and confirmations.</p>
        </div>
        <div class="card">
          <div class="landing__feature-icon">⛨</div>
          <h3>Nothing real at stake</h3>
          <p>Track balances and activity across every network your assets touch, in one unified view.</p>
        </div>
      </section>

      <footer class="landing__footer">
        <span>© 2026 Bitwallet</span>
      </footer>
    </div>
  `;
}

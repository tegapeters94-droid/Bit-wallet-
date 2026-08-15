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
        <span class="pill pill--muted">Prototype · All balances simulated</span>
        <h1>
          One wallet, <span class="text-gradient">seven chains</span>,
          <br />
          zero real money at risk.
        </h1>
        <p class="landing__sub">
          Bitwallet is a portfolio-grade demo of what a modern multi-chain wallet feels like —
          balances, transactions, sends and receives, all simulated so you can explore freely.
        </p>
        <div class="landing__hero-actions">
          <a href="#/signup" class="btn btn--primary btn--lg">Create a demo wallet</a>
          <a href="#/login" class="btn btn--ghost btn--lg">I already have one</a>
        </div>

        <div class="landing__networks">
          ${NETWORKS.map((n) => `<div class="landing__network-chip">${networkIconHtml(n.id, 28)}<span>${n.name}</span></div>`).join('')}
        </div>
      </section>

      <section class="landing__features">
        <div class="glass-card">
          <div class="landing__feature-icon">◈</div>
          <h3>Multi-chain by default</h3>
          <p>Ethereum, Bitcoin, Solana, Polygon, BNB Chain, Base, and Arbitrum in a single portfolio view.</p>
        </div>
        <div class="glass-card">
          <div class="landing__feature-icon">↻</div>
          <h3>Living transaction history</h3>
          <p>Send and receive flows generate realistic simulated transactions, gas fees, and confirmations.</p>
        </div>
        <div class="glass-card">
          <div class="landing__feature-icon">⛨</div>
          <h3>Nothing real at stake</h3>
          <p>No private keys, no seed phrases, no blockchain calls. Every number here is configurable demo data.</p>
        </div>
      </section>

      <footer class="landing__footer">
        <span>Bitwallet is a simulation. No cryptocurrency is stored, sent, or received.</span>
      </footer>
    </div>
  `;
}

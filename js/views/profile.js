// js/views/profile.js
import { getState } from '../state.js';
import { renderShell, escapeHtml } from '../shell.js';
import { subscribeToPortfolio } from '../wallet.js';
import { calculatePortfolioValue } from '../pricing.js';
import { formatUsd } from '../components.js';

export function mount(container) {
  const content = renderShell(container);
  const { user, profile, isAdmin } = getState();
  const initials = (profile?.name || user?.email || '?').slice(0, 1).toUpperCase();
  const createdDate =
    profile?.createdAt?.toDate?.()?.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) || '—';

  content.innerHTML = `
    <div class="page-header"><div><span class="page-eyebrow">Account</span><h1>Profile</h1></div></div>

    <div class="card profile-card">
      <span class="shell__avatar shell__avatar--lg">${initials}</span>
      <div>
        <h2>${escapeHtml(profile?.name || 'Wallet user')}</h2>
        <p class="auth-sub">${escapeHtml(user?.email || '')}</p>
        ${isAdmin ? `<span class="pill pill--accent">Admin</span>` : ''}
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <span class="page-eyebrow">Portfolio value</span>
        <div class="asset-detail__balance" id="portfolioValue">…</div>
      </div>
      <div class="card">
        <span class="page-eyebrow">Account created</span>
        <div class="asset-detail__balance" style="font-size:20px;">${createdDate}</div>
      </div>
    </div>

    <div class="card">
      <h3>Security</h3>
      <p class="auth-sub">
        Manage your recovery phrase and wallet addresses from Settings. Never share your recovery phrase with anyone.
      </p>
      <a href="#/settings" class="btn btn--ghost" style="margin-top:12px;">Go to Settings</a>
    </div>
  `;

  const unsub = subscribeToPortfolio(user.uid, (data) => {
    const visible = Object.fromEntries(Object.entries(data.assets || {}).filter(([, a]) => a.balance > 0));
    const portfolio = calculatePortfolioValue(visible);
    content.querySelector('#portfolioValue').textContent = formatUsd(portfolio.total);
  });

  return () => unsub();
}

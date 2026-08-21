// js/shell.js
// Builds the authenticated app shell: a wallet-identity header, the page's
// own content slot, a desktop sidebar, and a mobile bottom navigation bar.
// Shared across every protected/admin view so navigation, identity, and
// sign-out stay consistent everywhere.

import { getState } from './state.js';
import { logout } from './auth.js';
import { notify } from './toast.js';
import { navigate } from './router.js';
import { getUserPortfolio } from './wallet.js';
import { shortenAddress } from './address.js';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Home', icon: homeIcon() },
  { path: '/assets', label: 'Assets', icon: assetsIcon() },
  { path: '/activity', label: 'Activity', icon: activityIcon() },
  { path: '/settings', label: 'Settings', icon: settingsIcon() },
];

function currentPath() {
  const hash = window.location.hash || '#/';
  return hash.slice(1) || '/';
}

export function renderShell(container) {
  const { profile, user, isAdmin } = getState();
  const path = currentPath();
  const initials = (profile?.name || user?.email || '?').slice(0, 1).toUpperCase();
  const firstName = (profile?.name || 'My').split(' ')[0];

  container.innerHTML = `
    <div class="shell">
      <aside class="shell__sidebar">
        <a href="#/dashboard" class="shell__brand">
          <span class="shell__brand-mark">B</span>
          <span>Bitwallet</span>
        </a>

        <nav class="shell__nav">
          ${NAV_ITEMS.map(
            (item) => `
            <a href="#${item.path}" class="shell__nav-item ${path.startsWith(item.path) ? 'is-active' : ''}">
              <span class="shell__nav-icon">${item.icon}</span>
              ${item.label}
            </a>`
          ).join('')}
          ${
            isAdmin
              ? `<a href="#/admin" class="shell__nav-item shell__nav-item--admin ${path.startsWith('/admin') ? 'is-active' : ''}">
                  <span class="shell__nav-icon">${adminIcon()}</span>
                  Admin
                </a>`
              : ''
          }
        </nav>

        <button class="shell__profile" id="profileBtn">
          <span class="shell__avatar">${initials}</span>
          <div class="shell__profile-text">
            <strong>${escapeHtml(profile?.name || 'Wallet user')}</strong>
            <span>${escapeHtml(user?.email || '')}</span>
          </div>
        </button>
        <button class="shell__logout" id="logoutBtn">Sign out</button>
      </aside>

      <main class="shell__main">
        <header class="wallet-topbar">
          <div class="wallet-topbar__identity" id="identityBtn">
            <span class="shell__avatar shell__avatar--sm">${initials}</span>
            <div class="wallet-topbar__text">
              <strong>${escapeHtml(firstName)}'s Wallet</strong>
              <span class="mono" id="topbarAddress">···</span>
            </div>
            <button class="icon-btn icon-btn--tiny" id="topbarCopyBtn" aria-label="Copy address" title="Copy address">${copyIconSmall()}</button>
          </div>
          <div class="wallet-topbar__actions">
            <div class="wallet-menu" id="walletMenu">
              <button class="icon-btn" id="menuTrigger" aria-label="Wallet menu" aria-expanded="false">${dotsIcon()}</button>
              <div class="wallet-menu__dropdown" id="menuDropdown" style="display:none;">
                <a href="#/profile" class="wallet-menu__item">Profile</a>
                <a href="#/settings" class="wallet-menu__item">Settings</a>
                ${isAdmin ? `<a href="#/admin" class="wallet-menu__item">Admin panel</a>` : ''}
                <button class="wallet-menu__item wallet-menu__item--danger" id="menuLogoutBtn">Sign out</button>
              </div>
            </div>
          </div>
        </header>

        <div id="shellContent" class="shell__content"></div>
      </main>

      <nav class="bottom-nav">
        ${NAV_ITEMS.map(
          (item) => `
          <a href="#${item.path}" class="bottom-nav__item ${path.startsWith(item.path) ? 'is-active' : ''}">
            <span class="bottom-nav__icon">${item.icon}</span>
            <span>${item.label}</span>
          </a>`
        ).join('')}
      </nav>
    </div>
  `;

  container.querySelector('#logoutBtn').addEventListener('click', handleLogout);
  container.querySelector('#menuLogoutBtn').addEventListener('click', handleLogout);
  container.querySelector('#profileBtn').addEventListener('click', () => navigate('/profile'));
  container.querySelector('#identityBtn').addEventListener('click', (e) => {
    if (e.target.closest('#topbarCopyBtn')) return;
    navigate('/profile');
  });

  const menuTrigger = container.querySelector('#menuTrigger');
  const menuDropdown = container.querySelector('#menuDropdown');
  menuTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menuDropdown.style.display !== 'none';
    menuDropdown.style.display = open ? 'none' : 'block';
    menuTrigger.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', (e) => {
    if (!container.querySelector('#walletMenu')?.contains(e.target)) {
      menuDropdown.style.display = 'none';
    }
  });

  // Primary address for the quick-copy button in the identity bar — a
  // one-time read (not a live subscription) since this header renders on
  // every protected page and shouldn't stack up Firestore listeners.
  if (user) {
    getUserPortfolio(user.uid).then((p) => {
      const primary = p.assets?.ethereum?.address;
      if (!primary) return;
      const addrEl = container.querySelector('#topbarAddress');
      if (addrEl) addrEl.textContent = shortenAddress(primary, 4);
      container.querySelector('#topbarCopyBtn').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(primary);
          notify('Address copied');
        } catch {
          // clipboard API unavailable — fail silently, non-critical
        }
      });
    });
  }

  async function handleLogout() {
    await logout();
    notify('Signed out', { type: 'info' });
    navigate('/');
  }

  return container.querySelector('#shellContent');
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// Small original line-icon set (not copied from any icon library/brand).
function homeIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 4l8 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function assetsIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.8"/><circle cx="15" cy="15" r="5" stroke="currentColor" stroke-width="1.8"/></svg>`;
}
function activityIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12h4l2-7 4 14 2-7h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function settingsIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V19a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 13a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 2.6a1.7 1.7 0 0 0 1-1.56V1a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 7a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}
function adminIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}
function dotsIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`;
}
function copyIconSmall() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="2"/></svg>`;
}

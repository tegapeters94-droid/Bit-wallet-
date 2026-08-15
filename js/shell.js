// js/shell.js
// Builds the authenticated app shell (sidebar + content slot) and returns
// the element where a page should render its content. Shared across every
// protected/admin view so navigation and the sign-out button stay in sync.

import { getState } from './state.js';
import { logout } from './auth.js';
import { notify } from './toast.js';
import { navigate } from './router.js';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '◱' },
  { path: '/assets', label: 'Assets', icon: '◈' },
  { path: '/send', label: 'Send', icon: '↑' },
  { path: '/receive', label: 'Receive', icon: '↓' },
  { path: '/activity', label: 'Activity', icon: '☰' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
];

function currentPath() {
  const hash = window.location.hash || '#/';
  return hash.slice(1) || '/';
}

export function renderShell(container) {
  const { profile, user, isAdmin } = getState();
  const path = currentPath();
  const initials = (profile?.name || user?.email || '?').slice(0, 1).toUpperCase();

  container.innerHTML = `
    <div class="shell">
      <button class="shell__mobile-toggle" id="mobileToggle" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>

      <aside class="shell__sidebar" id="sidebar">
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
                  <span class="shell__nav-icon">◆</span>
                  Admin panel
                </a>`
              : ''
          }
        </nav>

        <div class="shell__sim-badge">Simulated data · No real funds</div>

        <button class="shell__profile" id="profileBtn">
          <span class="shell__avatar">${initials}</span>
          <div class="shell__profile-text">
            <strong>${escapeHtml(profile?.name || 'Wallet user')}</strong>
            <span>${escapeHtml(user?.email || '')}</span>
          </div>
        </button>
        <button class="shell__logout" id="logoutBtn">Sign out</button>
      </aside>

      <div class="shell__scrim" id="scrim" style="display:none;"></div>

      <main class="shell__main" id="shellContent"></main>
    </div>
  `;

  container.querySelector('#logoutBtn').addEventListener('click', async () => {
    await logout();
    notify('Signed out', { type: 'info' });
    navigate('/');
  });
  container.querySelector('#profileBtn').addEventListener('click', () => navigate('/profile'));

  const sidebar = container.querySelector('#sidebar');
  const scrim = container.querySelector('#scrim');
  const toggle = container.querySelector('#mobileToggle');
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('is-open');
    scrim.style.display = sidebar.classList.contains('is-open') ? 'block' : 'none';
  });
  scrim.addEventListener('click', () => {
    sidebar.classList.remove('is-open');
    scrim.style.display = 'none';
  });

  return container.querySelector('#shellContent');
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

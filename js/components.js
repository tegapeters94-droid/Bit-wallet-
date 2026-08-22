// js/components.js
// Small, framework-free helper functions that return HTML strings or wire
// up event listeners for repeated UI patterns: token icons, asset rows,
// transaction rows, quick actions, empty states, and the network switcher.

import { getNetwork, NETWORKS } from './networks.js';
import { escapeHtml } from './shell.js';

export function networkIconHtml(networkId, size = 40) {
  const net = getNetwork(networkId);
  if (!net) return '';
  return `<div class="token-icon" style="width:${size}px;height:${size}px;font-size:${size * 0.42}px;background:${net.color}1c;border:1px solid ${net.color}40;color:${net.color};" aria-hidden="true">${net.glyph}</div>`;
}

export function statusBadgeHtml(status) {
  return `<span class="status-badge status-badge--${status}">${status}</span>`;
}

export function copyButtonHtml(id, label = 'Copy') {
  return `<button class="copy-btn" data-copy-target="${id}" type="button">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="2"/></svg>
    ${label}
  </button>`;
}

export function wireCopyButtons(root, { onCopied } = {}) {
  root.querySelectorAll('[data-copy-target]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-copy-target');
      const text = btn.getAttribute('data-copy-text') || document.getElementById(targetId)?.textContent || '';
      try {
        await navigator.clipboard.writeText(text.trim());
        onCopied?.();
      } catch {
        // clipboard API unavailable — fail silently, non-critical
      }
    });
  });
}

export function emptyStateHtml({ icon = '◌', title, message = '', actionHtml = '' }) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${icon}</div>
      <h3>${escapeHtml(title)}</h3>
      ${message ? `<p>${escapeHtml(message)}</p>` : ''}
      ${actionHtml}
    </div>`;
}

export function skeletonCardHtml() {
  return `
    <div class="card" style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="skeleton" style="width:40px;height:40px;border-radius:12px;"></div>
        <div style="flex:1;">
          <div class="skeleton" style="width:60%;height:14px;border-radius:8px;"></div>
          <div style="height:6px;"></div>
          <div class="skeleton" style="width:40%;height:12px;border-radius:8px;"></div>
        </div>
        <div class="skeleton" style="width:70px;height:14px;border-radius:8px;"></div>
      </div>
    </div>`;
}

/** A single quick-action button (Receive / Send / etc.) for the dashboard. */
export function quickActionHtml({ href, icon, label }) {
  return `
    <a href="${href}" class="quick-action">
      <span class="quick-action__circle">${icon}</span>
      <span class="quick-action__label">${label}</span>
    </a>`;
}

export const QUICK_ACTION_ICONS = {
  receive: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v13M12 18l-5-5M12 18l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  send: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 19V6M12 6l-5 5M12 6l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  buy: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M7 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  swap: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 8h13l-3-3M20 16H7l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

export function assetRowHtml({ networkId, balance, usdValue, change24h }) {
  const net = getNetwork(networkId);
  if (!net) return '';
  const positive = change24h >= 0;
  return `
    <a href="#/asset/${networkId}" class="asset-row">
      ${networkIconHtml(networkId, 40)}
      <div class="asset-row__main">
        <div class="asset-row__name">${net.name}</div>
        <div class="asset-row__sub">${balance.toLocaleString(undefined, { maximumFractionDigits: net.decimals })} ${net.symbol}</div>
      </div>
      <div class="asset-row__value">
        <div class="asset-row__usd">${formatUsd(usdValue)}</div>
        <div class="asset-row__change ${positive ? 'is-up' : 'is-down'}">${positive ? '+' : ''}${change24h}%</div>
      </div>
    </a>`;
}

function txTypeMeta(type) {
  if (type === 'received') return { label: 'Received', sign: '+', className: 'is-in', icon: inIcon() };
  if (type === 'sent') return { label: 'Sent', sign: '−', className: 'is-out', icon: outIcon() };
  if (type === 'buy') return { label: 'Bought', sign: '+', className: 'is-in', icon: inIcon() };
  if (type === 'swap') return { label: 'Swapped', sign: '', className: 'is-swap', icon: swapIcon() };
  return { label: 'Network fee', sign: '−', className: 'is-gas', icon: gasIcon() };
}

function swapIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 8h13l-3-3M20 16H7l3 3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function inIcon() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v13M12 18l-5-5M12 18l5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function outIcon() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 19V6M12 6l-5 5M12 6l5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function gasIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 10h2a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V8l-2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function transactionRowHtml(tx) {
  const meta = txTypeMeta(tx.type);
  const net = getNetwork(tx.networkId);
  const toNet = tx.toNetworkId ? getNetwork(tx.toNetworkId) : null;
  const date = new Date(tx.timestamp);
  const amountLabel =
    tx.type === 'swap' && toNet
      ? `${tx.amount} ${tx.asset} → ${tx.toAmount} ${tx.toAsset}`
      : `${meta.sign}${tx.amount} ${tx.asset}`;

  return `
    <a href="#/asset/${tx.networkId}" class="tx-row" data-tx-id="${tx.docId}">
      <div class="tx-row__icon">
        ${networkIconHtml(tx.networkId, 36)}
        <span class="tx-row__dir ${meta.className}">${meta.icon}</span>
      </div>
      <div class="tx-row__main">
        <div class="tx-row__top">
          <span class="tx-row__label">${meta.label}${tx.type === 'swap' ? '' : ` ${net?.symbol ?? ''}`}</span>
          <span class="tx-row__amount ${meta.className}">${amountLabel}</span>
        </div>
        <div class="tx-row__bottom">
          <span>${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
          <span>${statusBadgeHtml(tx.status)}</span>
        </div>
      </div>
    </a>`;
}

/** Groups transactions into Today / Yesterday / Earlier this week / Older buckets. */
export function groupTransactionsByDate(transactions) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - 6 * 86400000;

  const buckets = { Today: [], Yesterday: [], 'Earlier this week': [], Older: [] };
  transactions.forEach((tx) => {
    if (tx.timestamp >= startOfToday) buckets.Today.push(tx);
    else if (tx.timestamp >= startOfYesterday) buckets.Yesterday.push(tx);
    else if (tx.timestamp >= startOfWeek) buckets['Earlier this week'].push(tx);
    else buckets.Older.push(tx);
  });
  return Object.entries(buckets).filter(([, list]) => list.length > 0);
}

export function transactionGroupsHtml(transactions) {
  const groups = groupTransactionsByDate(transactions);
  return groups
    .map(
      ([label, list]) => `
      <div class="tx-group">
        <div class="tx-group__label">${label}</div>
        <div class="tx-list">${list.map(transactionRowHtml).join('')}</div>
      </div>`
    )
    .join('');
}

/** Renders a network switcher dropdown into `mountEl` and calls onChange(networkIdOrAll) on selection. */
export function mountNetworkSwitcher(mountEl, value, onChange, { includeAll = true } = {}) {
  const current = value === 'all' ? null : getNetwork(value);
  mountEl.innerHTML = `
    <div class="network-switcher">
      <button class="network-switcher__trigger" type="button" id="nsTrigger" aria-expanded="false">
        ${
          current
            ? `${networkIconHtml(current.id, 20)}<span>${current.name}</span>`
            : `<span class="network-switcher__dot"></span><span>All networks</span>`
        }
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="opacity:.5"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <div class="network-switcher__menu" id="nsMenu" style="display:none;">
        ${
          includeAll
            ? `<button class="network-switcher__item ${value === 'all' ? 'is-active' : ''}" data-value="all"><span class="network-switcher__dot"></span>All networks</button>`
            : ''
        }
        ${NETWORKS.map(
          (n) =>
            `<button class="network-switcher__item ${value === n.id ? 'is-active' : ''}" data-value="${n.id}">${networkIconHtml(n.id, 20)}${n.name}</button>`
        ).join('')}
      </div>
    </div>`;

  const trigger = mountEl.querySelector('#nsTrigger');
  const menu = mountEl.querySelector('#nsMenu');
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.style.display !== 'none';
    menu.style.display = open ? 'none' : 'block';
    trigger.setAttribute('aria-expanded', String(!open));
  });
  menu.querySelectorAll('[data-value]').forEach((item) => {
    item.addEventListener('click', () => {
      menu.style.display = 'none';
      onChange(item.getAttribute('data-value'));
    });
  });

  if (mountEl._outsideClickHandler) {
    document.removeEventListener('click', mountEl._outsideClickHandler);
  }
  const outsideClick = (e) => {
    if (!mountEl.contains(e.target)) menu.style.display = 'none';
  };
  mountEl._outsideClickHandler = outsideClick;
  document.addEventListener('click', outsideClick);
}

/** Renders a row of time-range filter pills (1H/1D/1W/1M/1Y/ALL) into `mountEl`. */
export function mountRangeFilters(mountEl, ranges, value, onChange) {
  mountEl.innerHTML = `<div class="range-filters">
    ${ranges.map((r) => `<button class="range-filter ${r === value ? 'is-active' : ''}" data-range="${r}">${r}</button>`).join('')}
  </div>`;
  mountEl.querySelectorAll('[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => onChange(btn.getAttribute('data-range')));
  });
}

export function formatUsd(n) {
  return `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

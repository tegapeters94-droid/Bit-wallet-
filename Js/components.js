// js/components.js
// Small, framework-free helper functions that return HTML strings or wire
// up event listeners for repeated UI patterns: network icons, asset rows,
// transaction rows, empty states, and the network switcher dropdown.

import { getNetwork, NETWORKS } from './networks.js';
import { shortenAddress } from './address.js';
import { escapeHtml } from './shell.js';

export function networkIconHtml(networkId, size = 40) {
  const net = getNetwork(networkId);
  if (!net) return '';
  return `<div class="network-icon" style="width:${size}px;height:${size}px;font-size:${size * 0.46}px;background:linear-gradient(155deg, ${net.color}33, ${net.color}12);border:1px solid ${net.color}55;color:${net.color};" aria-hidden="true">${net.glyph}</div>`;
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

/** Wires up every [data-copy-target] button within `root` to copy the text of the element with that id. */
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
    <div class="glass-card" style="display:flex;flex-direction:column;gap:12px;">
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

export function assetRowHtml({ networkId, balance, usdValue, pct, change24h }) {
  const net = getNetwork(networkId);
  if (!net) return '';
  const positive = change24h >= 0;
  return `
    <a href="#/asset/${networkId}" class="asset-row">
      ${networkIconHtml(networkId, 44)}
      <div class="asset-row__main">
        <div class="asset-row__name">${net.name}</div>
        <div class="asset-row__sub">${balance.toLocaleString(undefined, { maximumFractionDigits: net.decimals })} ${net.symbol}</div>
      </div>
      ${
        typeof pct === 'number'
          ? `<div class="asset-row__pct">
              <div class="asset-row__pct-track"><div class="asset-row__pct-fill" style="width:${pct}%;background:${net.color};"></div></div>
              <span>${pct}%</span>
            </div>`
          : ''
      }
      <div class="asset-row__value">
        <div class="asset-row__usd">$${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="asset-row__change ${positive ? 'is-up' : 'is-down'}">${positive ? '▲' : '▼'} ${Math.abs(change24h)}%</div>
      </div>
    </a>`;
}

function txTypeMeta(type) {
  if (type === 'received') return { label: 'Received', sign: '+', className: 'is-in', arrow: '↓' };
  if (type === 'sent') return { label: 'Sent', sign: '−', className: 'is-out', arrow: '↑' };
  return { label: 'Gas', sign: '−', className: 'is-gas', arrow: '⛽' };
}

export function transactionRowHtml(tx) {
  const meta = txTypeMeta(tx.type);
  const net = getNetwork(tx.networkId);
  const date = new Date(tx.timestamp);
  return `
    <a href="#/asset/${tx.networkId}" class="tx-row" data-tx-id="${tx.docId}">
      <div class="tx-row__icon">
        ${networkIconHtml(tx.networkId, 38)}
        <span class="tx-row__dir ${meta.className}">${meta.arrow}</span>
      </div>
      <div class="tx-row__main">
        <div class="tx-row__top">
          <span class="tx-row__label">${meta.label}</span>
          <span class="tx-row__amount ${meta.className}">${meta.sign}${tx.amount} ${tx.asset}</span>
        </div>
        <div class="tx-row__bottom">
          <span>${tx.type === 'sent' ? `To ${shortenAddress(tx.to)}` : `From ${shortenAddress(tx.from)}`} · ${net?.name ?? ''}</span>
          <span>$${(tx.usdValue ?? 0).toLocaleString()}</span>
        </div>
      </div>
      <div class="tx-row__meta">
        ${statusBadgeHtml(tx.status)}
        <span class="tx-row__time">${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </a>`;
}

/** Renders a network switcher dropdown into `mountEl` and calls onChange(networkIdOrAll) on selection. */
export function mountNetworkSwitcher(mountEl, value, onChange, { includeAll = true } = {}) {
  const current = value === 'all' ? null : getNetwork(value);
  mountEl.innerHTML = `
    <div class="network-switcher">
      <button class="network-switcher__trigger" type="button" id="nsTrigger" aria-expanded="false">
        ${
          current
            ? `${networkIconHtml(current.id, 22)}<span>${current.name}</span>`
            : `<span class="network-switcher__dot"></span><span>All networks</span>`
        }
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="opacity:.6"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <div class="network-switcher__menu" id="nsMenu" style="display:none;">
        ${
          includeAll
            ? `<button class="network-switcher__item ${value === 'all' ? 'is-active' : ''}" data-value="all"><span class="network-switcher__dot"></span>All networks</button>`
            : ''
        }
        ${NETWORKS.map(
          (n) =>
            `<button class="network-switcher__item ${value === n.id ? 'is-active' : ''}" data-value="${n.id}">${networkIconHtml(n.id, 22)}${n.name}</button>`
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
  // Avoid stacking a new document-level listener on every re-mount.
  if (mountEl._outsideClickHandler) {
    document.removeEventListener('click', mountEl._outsideClickHandler);
  }
  const outsideClick = (e) => {
    if (!mountEl.contains(e.target)) menu.style.display = 'none';
  };
  mountEl._outsideClickHandler = outsideClick;
  document.addEventListener('click', outsideClick);
}

export function formatUsd(n) {
  return `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

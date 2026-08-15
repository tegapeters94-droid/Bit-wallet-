// js/views/activity.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToTransactions } from '../wallet.js';
import { transactionRowHtml, emptyStateHtml, mountNetworkSwitcher } from '../components.js';

const TYPE_FILTERS = ['all', 'sent', 'received', 'gas'];

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();

  let selectedNetwork = 'all';
  let typeFilter = 'all';
  let allTx = [];
  let unsubTx = null;

  function subscribe() {
    if (unsubTx) unsubTx();
    unsubTx = subscribeToTransactions(
      user.uid,
      (tx) => {
        allTx = tx;
        renderList();
      },
      { networkId: selectedNetwork === 'all' ? undefined : selectedNetwork }
    );
  }

  function renderShellHtml() {
    content.innerHTML = `
      <div class="page-header">
        <div><span class="page-eyebrow">History</span><h1>Activity</h1></div>
        <div id="networkSwitcher"></div>
      </div>
      <div class="filter-tabs" id="filterTabs">
        ${TYPE_FILTERS.map((f) => `<button class="filter-tab ${typeFilter === f ? 'is-active' : ''}" data-filter="${f}">${f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</button>`).join('')}
      </div>
      <section class="glass-card"><div id="txListActivity"></div></section>
    `;

    mountNetworkSwitcher(content.querySelector('#networkSwitcher'), selectedNetwork, (val) => {
      selectedNetwork = val;
      subscribe();
      renderShellHtml();
    });

    content.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        typeFilter = btn.getAttribute('data-filter');
        renderShellHtml();
      });
    });

    renderList();
  }

  function renderList() {
    const listEl = content.querySelector('#txListActivity');
    if (!listEl) return;
    const visible = typeFilter === 'all' ? allTx : allTx.filter((t) => t.type === typeFilter);
    if (visible.length === 0) {
      listEl.innerHTML = emptyStateHtml({ icon: '☰', title: 'No transactions', message: 'Nothing matches this filter yet.' });
    } else {
      listEl.innerHTML = `<div class="tx-list">${visible.map(transactionRowHtml).join('')}</div>`;
    }
  }

  subscribe();
  renderShellHtml();

  return () => {
    if (unsubTx) unsubTx();
  };
}

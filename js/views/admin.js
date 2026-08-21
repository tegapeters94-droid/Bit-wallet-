// js/views/admin.js
import { renderShell, escapeHtml } from '../shell.js';
import { NETWORKS, getNetwork } from '../networks.js';
import { calculatePortfolioValue } from '../pricing.js';
import { networkIconHtml, statusBadgeHtml, emptyStateHtml } from '../components.js';
import { notify } from '../toast.js';
import {
  listAllUsers,
  getUserPortfolio,
  updateAssetBalance,
  regenerateAddress,
  removeAsset,
  resetPortfolio,
  simulateIncomingPayment,
  simulateOutgoingPayment,
  subscribeToTransactions,
  setTransactionStatus,
} from '../wallet.js';

export function mount(container) {
  const content = renderShell(container);

  let users = [];
  let search = '';
  let loadingUsers = true;
  let selectedUid = null;
  let panelUnmount = null;

  content.innerHTML = `
    <div class="page-header"><div><span class="page-eyebrow">Restricted</span><h1>Admin panel</h1></div></div>
    <div class="admin-layout">
      <div class="card admin-user-list">
        <label class="field"><span>Search users</span><input id="searchInput" placeholder="Name or email" /></label>
        <div id="userItems"></div>
      </div>
      <div id="adminDetail">
        <div class="card">${emptyStateHtml({ icon: '◈', title: 'Select a user', message: 'Choose a user on the left to configure their wallet.' })}</div>
      </div>
    </div>
  `;

  function renderUserList() {
    const el = content.querySelector('#userItems');
    if (loadingUsers) {
      el.innerHTML = `<p class="auth-sub">Loading users…</p>`;
      return;
    }
    const q = search.trim().toLowerCase();
    const filtered = q
      ? users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      : users;

    if (filtered.length === 0) {
      el.innerHTML = emptyStateHtml({ icon: '◌', title: 'No users found' });
      return;
    }

    el.innerHTML = `<div class="admin-user-items">
      ${filtered
        .map(
          (u) => `
        <button class="admin-user-item ${selectedUid === u.uid ? 'is-active' : ''}" data-uid="${u.uid}">
          <span class="shell__avatar">${(u.name || u.email || '?').slice(0, 1).toUpperCase()}</span>
          <div><strong>${escapeHtml(u.name || 'Unnamed')}</strong><span>${escapeHtml(u.email || '')}</span></div>
          ${u.role === 'admin' ? `<span class="pill pill--accent">Admin</span>` : ''}
        </button>`
        )
        .join('')}
    </div>`;

    el.querySelectorAll('[data-uid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedUid = btn.getAttribute('data-uid');
        renderUserList();
        mountDetail();
      });
    });
  }

  function mountDetail() {
    if (panelUnmount) {
      panelUnmount();
      panelUnmount = null;
    }
    const detailEl = content.querySelector('#adminDetail');
    const user = users.find((u) => u.uid === selectedUid);
    if (!user) {
      detailEl.innerHTML = `<div class="card">${emptyStateHtml({ icon: '◈', title: 'Select a user', message: 'Choose a user on the left to configure their wallet.' })}</div>`;
      return;
    }
    panelUnmount = mountAdminUserPanel(detailEl, user);
  }

  content.querySelector('#searchInput').addEventListener('input', (e) => {
    search = e.target.value;
    renderUserList();
  });

  renderUserList();
  listAllUsers()
    .then((list) => {
      users = list;
    })
    .catch(() => notify('Could not load users', { type: 'error' }))
    .finally(() => {
      loadingUsers = false;
      renderUserList();
    });

  return () => {
    if (panelUnmount) panelUnmount();
  };
}

function mountAdminUserPanel(detailEl, user) {
  let assets = null;
  let draftBalances = {};
  let transactions = [];
  let savingNetwork = null;
  let busy = false;
  let genForm = { networkId: NETWORKS[0].id, type: 'received', amount: '0.1' };

  function render() {
    if (!assets) {
      detailEl.innerHTML = `<div class="card">Loading portfolio…</div>`;
      return;
    }
    const portfolioValue = calculatePortfolioValue(
      Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, { balance: v.balance }]))
    );

    detailEl.innerHTML = `
      <div class="admin-detail">
        <div class="card">
          <div class="section-head"><h3>${escapeHtml(user.name)}'s portfolio</h3><span class="pill pill--muted">$${portfolioValue.total.toLocaleString()}</span></div>
          <div class="admin-balance-grid">
            ${NETWORKS.map(
              (n) => `
              <div class="admin-balance-row">
                ${networkIconHtml(n.id, 30)}
                <span class="admin-balance-row__name">${n.symbol}</span>
                <input type="number" step="any" data-balance-input="${n.id}" value="${draftBalances[n.id] ?? ''}" />
                <button class="btn btn--ghost btn--sm" data-save="${n.id}" ${savingNetwork === n.id ? 'disabled' : ''}>${savingNetwork === n.id ? '…' : 'Save'}</button>
                <button class="btn btn--ghost btn--sm" data-regen="${n.id}">Regen addr</button>
                <button class="btn btn--ghost btn--sm" data-remove="${n.id}">Remove</button>
              </div>`
            ).join('')}
          </div>
        </div>

        <div class="card">
          <h3>Generate transaction</h3>
          <div class="admin-gen-form">
            <select id="genNetwork">${NETWORKS.map((n) => `<option value="${n.id}" ${genForm.networkId === n.id ? 'selected' : ''}>${n.name}</option>`).join('')}</select>
            <select id="genType">
              <option value="received" ${genForm.type === 'received' ? 'selected' : ''}>Received</option>
              <option value="sent" ${genForm.type === 'sent' ? 'selected' : ''}>Sent</option>
            </select>
            <input type="number" step="any" id="genAmount" placeholder="Amount" value="${genForm.amount}" />
            <button class="btn btn--primary" id="genBtn" ${busy ? 'disabled' : ''}>Generate</button>
          </div>
        </div>

        <div class="card">
          <div class="section-head"><h3>Recent transactions</h3></div>
          <div id="adminTxList">
            ${
              transactions.length === 0
                ? emptyStateHtml({ icon: '☰', title: 'No transactions' })
                : `<div class="admin-tx-list">${transactions
                    .map(
                      (tx) => `
                    <div class="admin-tx-row">
                      ${networkIconHtml(tx.networkId, 26)}
                      <span>${tx.type} · ${tx.amount} ${tx.asset}</span>
                      ${statusBadgeHtml(tx.status)}
                      <select data-tx-status="${tx.docId}">
                        <option value="confirmed" ${tx.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="pending" ${tx.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="failed" ${tx.status === 'failed' ? 'selected' : ''}>Failed</option>
                      </select>
                    </div>`
                    )
                    .join('')}</div>`
            }
          </div>
        </div>

        <div class="card">
          <h3 style="color:var(--danger);">Danger zone</h3>
          <p class="auth-sub" style="margin-bottom:12px;">Resets this user's balances to defaults and clears their transaction history.</p>
          <button class="btn btn--danger" id="resetUserBtn" ${busy ? 'disabled' : ''}>Reset this user's portfolio</button>
        </div>
      </div>
    `;

    wireEvents();
  }

  function wireEvents() {
    detailEl.querySelectorAll('[data-balance-input]').forEach((input) => {
      input.addEventListener('input', (e) => {
        draftBalances[input.getAttribute('data-balance-input')] = e.target.value;
      });
    });

    detailEl.querySelectorAll('[data-save]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const networkId = btn.getAttribute('data-save');
        const val = parseFloat(draftBalances[networkId]);
        if (Number.isNaN(val) || val < 0) {
          notify('Enter a valid non-negative balance', { type: 'error' });
          return;
        }
        savingNetwork = networkId;
        render();
        try {
          await updateAssetBalance(user.uid, networkId, val);
          assets[networkId] = { ...assets[networkId], balance: val };
          notify(`${getNetwork(networkId).name} balance updated`);
        } catch {
          notify('Could not update balance', { type: 'error' });
        } finally {
          savingNetwork = null;
          render();
        }
      });
    });

    detailEl.querySelectorAll('[data-regen]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const networkId = btn.getAttribute('data-regen');
        try {
          const addr = await regenerateAddress(user.uid, networkId);
          assets[networkId] = { ...assets[networkId], address: addr };
          notify('Address regenerated');
        } catch {
          notify('Could not regenerate address', { type: 'error' });
        }
      });
    });

    detailEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const networkId = btn.getAttribute('data-remove');
        await removeAsset(user.uid, networkId);
        assets[networkId] = { ...assets[networkId], balance: 0 };
        draftBalances[networkId] = '0';
        notify(`${getNetwork(networkId).name} asset removed`);
        render();
      });
    });

    detailEl.querySelector('#resetUserBtn')?.addEventListener('click', async () => {
      busy = true;
      render();
      try {
        const fresh = await resetPortfolio(user.uid);
        assets = fresh;
        draftBalances = Object.fromEntries(Object.entries(fresh).map(([k, v]) => [k, String(v.balance)]));
        notify('Portfolio reset to defaults');
      } finally {
        busy = false;
        render();
      }
    });

    detailEl.querySelector('#genNetwork')?.addEventListener('change', (e) => (genForm.networkId = e.target.value));
    detailEl.querySelector('#genType')?.addEventListener('change', (e) => (genForm.type = e.target.value));
    detailEl.querySelector('#genAmount')?.addEventListener('input', (e) => (genForm.amount = e.target.value));
    detailEl.querySelector('#genBtn')?.addEventListener('click', async () => {
      const amt = parseFloat(genForm.amount);
      if (!amt || amt <= 0) {
        notify('Enter a valid amount', { type: 'error' });
        return;
      }
      busy = true;
      render();
      try {
        if (genForm.type === 'received') {
          await simulateIncomingPayment(user.uid, { networkId: genForm.networkId, amount: amt });
        } else {
          await simulateOutgoingPayment(user.uid, { networkId: genForm.networkId, amount: amt, toAddress: undefined });
        }
        notify('Transaction generated');
      } catch (err) {
        notify(err.message, { type: 'error' });
      } finally {
        busy = false;
        render();
      }
    });

    detailEl.querySelectorAll('[data-tx-status]').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        setTransactionStatus(user.uid, sel.getAttribute('data-tx-status'), e.target.value);
      });
    });
  }

  getUserPortfolio(user.uid).then((p) => {
    assets = p.assets;
    draftBalances = Object.fromEntries(Object.entries(p.assets).map(([k, v]) => [k, String(v.balance)]));
    render();
  });

  const unsubTx = subscribeToTransactions(user.uid, (tx) => {
    transactions = tx.slice(0, 25);
    if (assets) render();
  });

  render();

  return () => unsubTx();
}

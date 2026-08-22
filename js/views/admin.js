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
import {
  subscribeToCustomTokens,
  createCustomToken,
  updateCustomToken,
  deleteCustomToken,
  getCirculatingSupply,
} from '../customTokens.js';

export function mount(container) {
  const content = renderShell(container);

  let users = [];
  let search = '';
  let loadingUsers = true;
  let selectedUid = null;
  let panelUnmount = null;
  let customTokens = [];

  content.innerHTML = `
    <div class="page-header"><h1>Admin panel</h1></div>

    <section class="card" id="tokenSection"></section>

    <div class="admin-layout" style="margin-top:20px;">
      <div class="card admin-user-list">
        <label class="field"><span>Search users</span><input id="searchInput" placeholder="Name or email" /></label>
        <div id="userItems"></div>
      </div>
      <div id="adminDetail">
        <div class="card">${emptyStateHtml({ icon: '◈', title: 'Select a user', message: 'Choose a user on the left to configure their wallet.' })}</div>
      </div>
    </div>
  `;

  // ---------- Custom tokens ----------
  let tokenFormOpen = false;
  let tokenForm = { id: '', name: '', symbol: '', price: '', maxSupply: '', color: '#8b6cf7' };
  let tokenBusy = false;

  function renderTokenSection() {
    const el = content.querySelector('#tokenSection');
    el.innerHTML = `
      <div class="section-head"><h3>Custom tokens</h3>
        <button class="btn btn--ghost btn--sm" id="toggleTokenForm">${tokenFormOpen ? 'Cancel' : 'Create token'}</button>
      </div>
      ${
        tokenFormOpen
          ? `<div class="admin-token-form">
              <div class="admin-token-form__row">
                <label class="field"><span>Token ID (lowercase, no spaces)</span><input id="tf_id" placeholder="mytoken" value="${escapeHtml(tokenForm.id)}" /></label>
                <label class="field"><span>Name</span><input id="tf_name" placeholder="My Token" value="${escapeHtml(tokenForm.name)}" /></label>
              </div>
              <div class="admin-token-form__row">
                <label class="field"><span>Symbol</span><input id="tf_symbol" placeholder="MTK" value="${escapeHtml(tokenForm.symbol)}" /></label>
                <label class="field"><span>Color</span><input id="tf_color" type="color" value="${tokenForm.color}" /></label>
              </div>
              <div class="admin-token-form__row">
                <label class="field"><span>Price (USD)</span><input id="tf_price" type="number" step="any" placeholder="1.00" value="${escapeHtml(tokenForm.price)}" /></label>
                <label class="field"><span>Max supply (optional)</span><input id="tf_maxSupply" type="number" step="any" placeholder="Unlimited" value="${escapeHtml(tokenForm.maxSupply)}" /></label>
              </div>
              <button class="btn btn--primary" id="createTokenBtn" ${tokenBusy ? 'disabled' : ''}>${tokenBusy ? 'Creating…' : 'Create token'}</button>
            </div>`
          : ''
      }
      <div class="admin-token-list" id="tokenList">
        ${
          customTokens.length === 0
            ? `<p class="auth-sub" style="margin-top:8px;">No custom tokens yet. They'll appear alongside the built-in networks once created.</p>`
            : customTokens
                .map(
                  (t) => `
              <div class="admin-token-row">
                ${networkIconHtml(t.id, 30)}
                <div class="admin-token-row__main">
                  <strong>${escapeHtml(t.name)} <span class="mono" style="color:var(--text-tertiary);">${escapeHtml(t.symbol)}</span></strong>
                  <span>Max supply: ${t.maxSupply != null ? t.maxSupply.toLocaleString() : 'Unlimited'}</span>
                </div>
                <input type="number" step="any" data-token-price="${t.id}" value="${t.price}" style="width:100px;" />
                <button class="btn btn--ghost btn--sm" data-save-price="${t.id}">Save</button>
                <button class="btn btn--ghost btn--sm" data-delete-token="${t.id}">Delete</button>
              </div>`
                )
                .join('')
        }
      </div>
    `;

    el.querySelector('#toggleTokenForm').addEventListener('click', () => {
      tokenFormOpen = !tokenFormOpen;
      renderTokenSection();
    });

    if (tokenFormOpen) {
      el.querySelector('#createTokenBtn').addEventListener('click', async () => {
        const id = el.querySelector('#tf_id').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const name = el.querySelector('#tf_name').value.trim();
        const symbol = el.querySelector('#tf_symbol').value.trim().toUpperCase();
        const color = el.querySelector('#tf_color').value;
        const price = parseFloat(el.querySelector('#tf_price').value);
        const maxSupplyRaw = el.querySelector('#tf_maxSupply').value.trim();
        const maxSupply = maxSupplyRaw ? parseFloat(maxSupplyRaw) : null;

        if (!id || !name || !symbol) {
          notify('Token ID, name, and symbol are required', { type: 'error' });
          return;
        }
        if (getNetwork(id)) {
          notify('That token ID is already in use', { type: 'error' });
          return;
        }
        if (!price || price <= 0) {
          notify('Enter a valid price greater than zero', { type: 'error' });
          return;
        }
        tokenBusy = true;
        renderTokenSection();
        try {
          await createCustomToken({ id, name, symbol, color, price, maxSupply });
          notify(`${symbol} created`);
          tokenForm = { id: '', name: '', symbol: '', price: '', maxSupply: '', color: '#8b6cf7' };
          tokenFormOpen = false;
        } catch (err) {
          notify(`Could not create token: ${err.message}`, { type: 'error' });
        } finally {
          tokenBusy = false;
          renderTokenSection();
        }
      });
    }

    el.querySelectorAll('[data-save-price]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-save-price');
        const input = el.querySelector(`[data-token-price="${id}"]`);
        const price = parseFloat(input.value);
        if (!price || price <= 0) {
          notify('Enter a valid price', { type: 'error' });
          return;
        }
        try {
          await updateCustomToken(id, { price });
          notify('Price updated');
        } catch (err) {
          notify(`Could not update price: ${err.message}`, { type: 'error' });
        }
      });
    });

    el.querySelectorAll('[data-delete-token]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-delete-token');
        try {
          await deleteCustomToken(id);
          notify('Token deleted');
        } catch (err) {
          notify(`Could not delete token: ${err.message}`, { type: 'error' });
        }
      });
    });
  }

  const unsubTokens = subscribeToCustomTokens((tokens) => {
    customTokens = tokens;
    renderTokenSection();
    // A token was added/removed — the per-user balance grid (which lists
    // every entry in NETWORKS) should reflect that if a user is selected.
    if (selectedUid) mountDetail();
  });

  // ---------- User list ----------
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

  renderTokenSection();
  renderUserList();
  listAllUsers()
    .then((list) => {
      users = list;
    })
    .catch((err) => notify(`Could not load users: ${err.message}`, { type: 'error' }))
    .finally(() => {
      loadingUsers = false;
      renderUserList();
    });

  return () => {
    if (panelUnmount) panelUnmount();
    unsubTokens();
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
      Object.fromEntries(NETWORKS.map((n) => [n.id, { balance: assets[n.id]?.balance ?? 0 }]))
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
                <input type="number" step="any" data-balance-input="${n.id}" value="${draftBalances[n.id] ?? '0'}" />
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
        const raw = draftBalances[networkId];
        const val = parseFloat(raw);
        if (raw === undefined || raw === '' || Number.isNaN(val) || val < 0) {
          notify('Enter a valid non-negative balance', { type: 'error' });
          return;
        }

        const net = getNetwork(networkId);
        if (net && !net.builtin && net.maxSupply != null) {
          try {
            const othersSupply = await getCirculatingSupply(networkId, { excludeUid: user.uid });
            if (othersSupply + val > net.maxSupply) {
              notify(`This would exceed ${net.symbol}'s max supply of ${net.maxSupply.toLocaleString()} (${othersSupply.toLocaleString()} already held by other users)`, { type: 'error' });
              return;
            }
          } catch (err) {
            notify(`Could not verify supply cap: ${err.message}`, { type: 'error' });
            return;
          }
        }

        savingNetwork = networkId;
        render();
        try {
          // A custom token created after this user's portfolio was first
          // set up won't have an address entry yet — generate one before
          // writing a balance so Send/Receive/Asset pages don't break.
          if (!assets[networkId]?.address) {
            const addr = await regenerateAddress(user.uid, networkId);
            assets[networkId] = { ...(assets[networkId] || {}), address: addr };
          }
          await updateAssetBalance(user.uid, networkId, val);
          assets[networkId] = { ...(assets[networkId] || {}), balance: val };
          notify(`${net?.name ?? networkId} balance updated`);
        } catch (err) {
          notify(`Could not update balance: ${err.message}`, { type: 'error' });
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
        } catch (err) {
          notify(`Could not regenerate address: ${err.message}`, { type: 'error' });
        }
      });
    });

    detailEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const networkId = btn.getAttribute('data-remove');
        try {
          await removeAsset(user.uid, networkId);
          assets[networkId] = { ...assets[networkId], balance: 0 };
          draftBalances[networkId] = '0';
          notify(`${getNetwork(networkId)?.name ?? networkId} asset removed`);
          render();
        } catch (err) {
          notify(`Could not remove asset: ${err.message}`, { type: 'error' });
        }
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
      } catch (err) {
        notify(`Could not reset portfolio: ${err.message}`, { type: 'error' });
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
        notify(`Could not generate transaction: ${err.message}`, { type: 'error' });
      } finally {
        busy = false;
        render();
      }
    });

    detailEl.querySelectorAll('[data-tx-status]').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        try {
          await setTransactionStatus(user.uid, sel.getAttribute('data-tx-status'), e.target.value);
        } catch (err) {
          notify(`Could not update status: ${err.message}`, { type: 'error' });
        }
      });
    });
  }

  getUserPortfolio(user.uid)
    .then((p) => {
      assets = p.assets;
      draftBalances = Object.fromEntries(NETWORKS.map((n) => [n.id, String(p.assets[n.id]?.balance ?? 0)]));
      render();
    })
    .catch((err) => {
      detailEl.innerHTML = `<div class="card">Could not load this user's portfolio: ${escapeHtml(err.message)}</div>`;
    });

  const unsubTx = subscribeToTransactions(user.uid, (tx) => {
    transactions = tx.slice(0, 25);
    if (assets) render();
  });

  render();

  return () => unsubTx();
}

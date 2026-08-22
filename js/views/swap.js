// js/views/swap.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, simulateSwap } from '../wallet.js';
import { NETWORKS, getNetwork } from '../networks.js';
import { getAssetPrice } from '../pricing.js';
import { networkIconHtml } from '../components.js';
import { notify } from '../toast.js';
import { navigate } from '../router.js';

const SPREAD_PCT = 0.005;

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();

  let fromNetworkId = NETWORKS[0].id;
  let toNetworkId = NETWORKS[1].id;
  let fromAmount = '';
  let assets = null;
  let step = 'form';
  let result = null;

  function balanceFor(id) {
    return assets?.[id]?.balance ?? 0;
  }

  function render() {
    const fromNet = getNetwork(fromNetworkId);
    const toNet = getNetwork(toNetworkId);
    const fromPrice = getAssetPrice(fromNetworkId).price;
    const toPrice = getAssetPrice(toNetworkId).price;
    const amount = parseFloat(fromAmount) || 0;
    const usdValue = amount * fromPrice;
    const toAmount = toPrice ? +((usdValue * (1 - SPREAD_PCT)) / toPrice).toFixed(6) : 0;
    const rate = toPrice ? +(fromPrice / toPrice).toFixed(6) : 0;
    const balance = balanceFor(fromNetworkId);

    let inner = '';

    if (step === 'form') {
      inner = `
        <div class="swap-box">
          <div class="swap-box__label">You pay</div>
          <div class="swap-box__row">
            <input type="number" step="any" id="fromAmount" placeholder="0.00" value="${fromAmount}" />
            <select id="fromNetwork">${NETWORKS.map((n) => `<option value="${n.id}" ${fromNetworkId === n.id ? 'selected' : ''}>${n.symbol}</option>`).join('')}</select>
          </div>
          <div class="swap-box__hint">
            Available: ${balance.toLocaleString(undefined, { maximumFractionDigits: fromNet.decimals })} ${fromNet.symbol}
            · <button type="button" class="link-more" id="maxBtn">Max</button>
          </div>
        </div>

        <button type="button" class="swap-flip" id="flipBtn" aria-label="Flip assets">${swapFlipIcon()}</button>

        <div class="swap-box">
          <div class="swap-box__label">You receive</div>
          <div class="swap-box__row">
            <input type="text" readonly value="${toAmount || '0.00'}" />
            <select id="toNetwork">${NETWORKS.map((n) => `<option value="${n.id}" ${toNetworkId === n.id ? 'selected' : ''}>${n.symbol}</option>`).join('')}</select>
          </div>
        </div>

        <div class="send-summary" style="margin-top:16px;">
          <div><span>Rate</span><span>1 ${fromNet.symbol} ≈ ${rate} ${toNet.symbol}</span></div>
          <div><span>Network fee</span><span>Included</span></div>
          <div><span>Price impact</span><span>&lt; 0.1%</span></div>
          <div><span>Minimum received</span><span>${toAmount} ${toNet.symbol}</span></div>
        </div>

        <button class="btn btn--primary btn--block" id="reviewBtn">Review swap</button>
      `;
    } else if (step === 'confirm') {
      inner = `
        <div class="send-confirm">
          <h3>Confirm swap</h3>
          <p class="auth-sub">Review the details before confirming.</p>
          <div class="send-summary">
            <div><span>You pay</span><span>${amount} ${fromNet.symbol}</span></div>
            <div><span>You receive</span><span>${toAmount} ${toNet.symbol}</span></div>
            <div><span>Rate</span><span>1 ${fromNet.symbol} ≈ ${rate} ${toNet.symbol}</span></div>
          </div>
          <div class="send-confirm__actions">
            <button class="btn btn--ghost btn--block" id="editBtn">Edit</button>
            <button class="btn btn--primary btn--block" id="confirmBtn">Confirm swap</button>
          </div>
        </div>`;
    } else if (step === 'processing') {
      inner = `
        <div class="send-confirm send-confirm--processing">
          <div class="spinner spinner--lg"></div>
          <h3>Swapping…</h3>
        </div>`;
    } else if (step === 'done' && result) {
      inner = `
        <div class="send-confirm send-confirm--done">
          <div class="success-check">✓</div>
          <h3>Swap complete</h3>
          <div class="send-summary">
            <div><span>Swapped</span><span>${amount} ${fromNet.symbol} → ${result.toAmount} ${toNet.symbol}</span></div>
          </div>
          <div class="send-confirm__actions">
            <button class="btn btn--ghost btn--block" id="anotherBtn">Swap again</button>
            <button class="btn btn--primary btn--block" id="viewActivityBtn">View activity</button>
          </div>
        </div>`;
    }

    content.innerHTML = `
      <div class="page-header"><h1>Swap</h1></div>
      <div class="send-layout"><div class="card send-form">${inner}</div></div>
    `;

    wireEvents();
  }

  function wireEvents() {
    if (step === 'form') {
      content.querySelector('#fromAmount')?.addEventListener('input', (e) => {
        fromAmount = e.target.value;
        render();
      });
      content.querySelector('#fromNetwork')?.addEventListener('change', (e) => {
        fromNetworkId = e.target.value;
        if (fromNetworkId === toNetworkId) toNetworkId = NETWORKS.find((n) => n.id !== fromNetworkId).id;
        render();
      });
      content.querySelector('#toNetwork')?.addEventListener('change', (e) => {
        toNetworkId = e.target.value;
        if (fromNetworkId === toNetworkId) fromNetworkId = NETWORKS.find((n) => n.id !== toNetworkId).id;
        render();
      });
      content.querySelector('#maxBtn')?.addEventListener('click', () => {
        fromAmount = String(balanceFor(fromNetworkId));
        render();
      });
      content.querySelector('#flipBtn')?.addEventListener('click', () => {
        [fromNetworkId, toNetworkId] = [toNetworkId, fromNetworkId];
        render();
      });
      content.querySelector('#reviewBtn')?.addEventListener('click', () => {
        const amount = parseFloat(fromAmount) || 0;
        if (!amount || amount <= 0) {
          notify('Enter an amount greater than zero', { type: 'error' });
          return;
        }
        if (amount > balanceFor(fromNetworkId)) {
          notify('Insufficient balance for this swap', { type: 'error' });
          return;
        }
        step = 'confirm';
        render();
      });
    } else if (step === 'confirm') {
      content.querySelector('#editBtn')?.addEventListener('click', () => {
        step = 'form';
        render();
      });
      content.querySelector('#confirmBtn')?.addEventListener('click', async () => {
        step = 'processing';
        render();
        await new Promise((r) => setTimeout(r, 900));
        try {
          const amount = parseFloat(fromAmount) || 0;
          const res = await simulateSwap(user.uid, {
            fromNetworkId,
            toNetworkId,
            fromAmount: amount,
            spreadPct: SPREAD_PCT,
          });
          result = res;
          step = 'done';
          notify('Swap complete');
        } catch (err) {
          notify(err.message, { type: 'error' });
          step = 'form';
        }
        render();
      });
    } else if (step === 'done') {
      content.querySelector('#anotherBtn')?.addEventListener('click', () => {
        step = 'form';
        fromAmount = '';
        result = null;
        render();
      });
      content.querySelector('#viewActivityBtn')?.addEventListener('click', () => navigate('/activity'));
    }
  }

  render();

  const unsub = subscribeToPortfolio(user.uid, (data) => {
    assets = data.assets || {};
    if (step === 'form') render();
  });

  return () => unsub();
}

function swapFlipIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

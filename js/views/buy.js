// js/views/buy.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { simulatePurchase } from '../wallet.js';
import { NETWORKS, getNetwork } from '../networks.js';
import { getAssetPrice } from '../pricing.js';
import { networkIconHtml, formatUsd } from '../components.js';
import { notify } from '../toast.js';
import { navigate } from '../router.js';

const FEE_PCT = 0.015;

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();

  let networkId = NETWORKS[0].id;
  let usdAmount = '100';
  let step = 'form'; // form | processing | done
  let result = null;

  function render() {
    const net = getNetwork(networkId);
    const { price } = getAssetPrice(networkId);
    const amount = parseFloat(usdAmount) || 0;
    const fee = +(amount * FEE_PCT).toFixed(2);
    const netUsd = amount - fee;
    const tokenAmount = price ? +(netUsd / price).toFixed(6) : 0;

    let inner = '';

    if (step === 'form') {
      inner = `
        <form id="buyForm">
          <label class="field">
            <span>Asset</span>
            <div class="select-grid">
              ${NETWORKS.map(
                (n) => `<button type="button" class="select-chip ${networkId === n.id ? 'is-active' : ''}" data-network="${n.id}">${networkIconHtml(n.id, 22)}${n.symbol}</button>`
              ).join('')}
            </div>
          </label>

          <label class="field">
            <span>Amount (USD)</span>
            <input type="number" step="any" id="usdAmount" value="${usdAmount}" />
          </label>

          <div class="send-summary">
            <div><span>You pay</span><span>${formatUsd(amount)}</span></div>
            <div><span>Fee (${(FEE_PCT * 100).toFixed(1)}%)</span><span>${formatUsd(fee)}</span></div>
            <div class="send-summary__total"><span>You receive</span><span>${tokenAmount} ${net.symbol}</span></div>
          </div>

          <button class="btn btn--primary btn--block" type="submit">Buy ${net.symbol}</button>
        </form>`;
    } else if (step === 'processing') {
      inner = `
        <div class="send-confirm send-confirm--processing">
          <div class="spinner spinner--lg"></div>
          <h3>Processing purchase…</h3>
        </div>`;
    } else if (step === 'done' && result) {
      inner = `
        <div class="send-confirm send-confirm--done">
          <div class="success-check">✓</div>
          <h3>Purchase complete</h3>
          <div class="send-summary">
            <div><span>Bought</span><span>${result.tokenAmount} ${net.symbol}</span></div>
            <div><span>New balance</span><span>${result.newBalance} ${net.symbol}</span></div>
          </div>
          <div class="send-confirm__actions">
            <button class="btn btn--ghost btn--block" id="anotherBtn">Buy more</button>
            <button class="btn btn--primary btn--block" id="viewAssetBtn">View asset</button>
          </div>
        </div>`;
    }

    content.innerHTML = `
      <div class="page-header"><h1>Buy</h1></div>
      <div class="send-layout"><div class="card send-form">${inner}</div></div>
    `;

    wireEvents();
  }

  function wireEvents() {
    if (step === 'form') {
      content.querySelectorAll('[data-network]').forEach((btn) => {
        btn.addEventListener('click', () => {
          networkId = btn.getAttribute('data-network');
          render();
        });
      });
      content.querySelector('#usdAmount')?.addEventListener('input', (e) => {
        usdAmount = e.target.value;
      });
      content.querySelector('#buyForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(usdAmount) || 0;
        if (!amount || amount <= 0) {
          notify('Enter an amount greater than zero', { type: 'error' });
          return;
        }
        step = 'processing';
        render();
        await new Promise((r) => setTimeout(r, 900));
        try {
          const res = await simulatePurchase(user.uid, { networkId, usdAmount: amount, feePct: FEE_PCT });
          result = res;
          step = 'done';
          notify('Purchase complete');
        } catch (err) {
          notify(err.message, { type: 'error' });
          step = 'form';
        }
        render();
      });
    } else if (step === 'done') {
      content.querySelector('#anotherBtn')?.addEventListener('click', () => {
        step = 'form';
        result = null;
        render();
      });
      content.querySelector('#viewAssetBtn')?.addEventListener('click', () => navigate(`/asset/${networkId}`));
    }
  }

  render();
  return () => {};
}

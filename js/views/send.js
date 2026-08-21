// js/views/send.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, simulateOutgoingPayment } from '../wallet.js';
import { NETWORKS, getNetwork } from '../networks.js';
import { calculateGasFee } from '../txEngine.js';
import { networkIconHtml } from '../components.js';
import { notify } from '../toast.js';
import { navigate } from '../router.js';

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();

  let networkId = NETWORKS[0].id;
  let assets = null;
  let gas = calculateGasFee(networkId);
  let step = 'form'; // form | confirm | processing | done
  let error = '';
  let result = null;
  let formValues = { recipient: '', amount: '' };

  function balanceFor(id) {
    return assets?.[id]?.balance ?? 0;
  }

  function render() {
    const net = getNetwork(networkId);
    const balance = balanceFor(networkId);
    const parsedAmount = parseFloat(formValues.amount) || 0;
    const total = +(parsedAmount + gas.fee).toFixed(8);

    let inner = '';

    if (step === 'form') {
      inner = `
        <form id="sendForm">
          <label class="field">
            <span>Network</span>
            <div class="select-grid">
              ${NETWORKS.map(
                (n) => `<button type="button" class="select-chip ${networkId === n.id ? 'is-active' : ''}" data-network="${n.id}">${networkIconHtml(n.id, 22)}${n.symbol}</button>`
              ).join('')}
            </div>
          </label>

          <label class="field">
            <span>Recipient address</span>
            <input class="mono" id="recipient" placeholder="${net.name} address" value="${formValues.recipient}" />
          </label>

          <label class="field">
            <span>Amount (${net.symbol})</span>
            <input type="number" step="any" id="amount" placeholder="0.00" value="${formValues.amount}" />
            <span class="field__hint">
              Available: ${balance.toLocaleString(undefined, { maximumFractionDigits: net.decimals })} ${net.symbol}
              · <button type="button" class="link-more" id="maxBtn">Max</button>
            </span>
          </label>

          ${error ? `<div class="alert alert--error">${error}</div>` : ''}

          <div class="send-summary">
            <div><span>Amount</span><span>${parsedAmount || 0} ${net.symbol}</span></div>
            <div><span>Network fee</span><span>${gas.fee} ${net.symbol} ($${gas.usdValue})</span></div>
            <div class="send-summary__total"><span>Total</span><span>${total} ${net.symbol}</span></div>
          </div>

          <button class="btn btn--primary btn--block" type="submit">Review transfer</button>
        </form>`;
    } else if (step === 'confirm') {
      inner = `
        <div class="send-confirm">
          ${networkIconHtml(networkId, 56)}
          <h3>Confirm send</h3>
          <p class="auth-sub">Review the details before confirming.</p>
          <div class="send-summary">
            <div><span>Network</span><span>${net.name}</span></div>
            <div><span>To</span><span class="mono">${formValues.recipient.slice(0, 10)}…${formValues.recipient.slice(-6)}</span></div>
            <div><span>Amount</span><span>${parsedAmount} ${net.symbol}</span></div>
            <div><span>Gas fee</span><span>${gas.fee} ${net.symbol}</span></div>
            <div class="send-summary__total"><span>Total deducted</span><span>${total} ${net.symbol}</span></div>
          </div>
          <div class="send-confirm__actions">
            <button class="btn btn--ghost btn--block" id="editBtn">Edit</button>
            <button class="btn btn--primary btn--block" id="confirmBtn">Confirm & send</button>
          </div>
        </div>`;
    } else if (step === 'processing') {
      inner = `
        <div class="send-confirm send-confirm--processing">
          <div class="spinner spinner--lg"></div>
          <h3>Sending…</h3>
          <p class="auth-sub">Generating confirmation on ${net.name}.</p>
        </div>`;
    } else if (step === 'done' && result) {
      inner = `
        <div class="send-confirm send-confirm--done">
          <div class="success-check">✓</div>
          <h3>Transaction confirmed</h3>
          <p class="auth-sub">Your balance has been updated.</p>
          <div class="send-summary">
            <div><span>Sent</span><span>${parsedAmount} ${net.symbol}</span></div>
            <div><span>New balance</span><span>${result.newBalance} ${net.symbol}</span></div>
            <div><span>Tx hash</span><span class="mono">${result.tx.hash.slice(0, 12)}…</span></div>
          </div>
          <div class="send-confirm__actions">
            <button class="btn btn--ghost btn--block" id="anotherBtn">Send another</button>
            <button class="btn btn--primary btn--block" id="viewActivityBtn">View activity</button>
          </div>
        </div>`;
    }

    content.innerHTML = `
      <div class="page-header"><h1>Send</h1></div>
      <div class="send-layout"><div class="card send-form">${inner}</div></div>
    `;

    wireEvents();
  }

  function wireEvents() {
    if (step === 'form') {
      content.querySelectorAll('[data-network]').forEach((btn) => {
        btn.addEventListener('click', () => {
          networkId = btn.getAttribute('data-network');
          gas = calculateGasFee(networkId);
          render();
        });
      });
      content.querySelector('#maxBtn')?.addEventListener('click', () => {
        formValues.amount = String(balanceFor(networkId));
        render();
      });
      // Keep formValues in sync as the person types, so a live portfolio
      // snapshot re-render never wipes out unsaved input.
      content.querySelector('#recipient')?.addEventListener('input', (e) => {
        formValues.recipient = e.target.value;
      });
      content.querySelector('#amount')?.addEventListener('input', (e) => {
        formValues.amount = e.target.value;
      });
      content.querySelector('#sendForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        formValues.recipient = content.querySelector('#recipient').value;
        formValues.amount = content.querySelector('#amount').value;
        const parsedAmount = parseFloat(formValues.amount) || 0;
        const total = +(parsedAmount + gas.fee).toFixed(8);
        const balance = balanceFor(networkId);

        if (!formValues.recipient.trim() || formValues.recipient.trim().length < 6) {
          error = 'Enter a valid recipient address.';
        } else if (!parsedAmount || parsedAmount <= 0) {
          error = 'Enter an amount greater than zero.';
        } else if (total > balance) {
          error = 'Amount plus gas fee exceeds your available balance.';
        } else {
          error = '';
          step = 'confirm';
        }
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
        await new Promise((r) => setTimeout(r, 1100));
        try {
          const parsedAmount = parseFloat(formValues.amount) || 0;
          const res = await simulateOutgoingPayment(user.uid, {
            networkId,
            amount: parsedAmount,
            toAddress: formValues.recipient.trim(),
          });
          result = res;
          step = 'done';
          notify('Transaction confirmed');
        } catch (err) {
          error = err.message;
          step = 'form';
        }
        render();
      });
    } else if (step === 'done') {
      content.querySelector('#anotherBtn')?.addEventListener('click', () => {
        step = 'form';
        formValues = { recipient: '', amount: '' };
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

// js/views/receive.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, simulateIncomingPayment } from '../wallet.js';
import { NETWORKS, getNetwork } from '../networks.js';
import { networkIconHtml, copyButtonHtml, wireCopyButtons, mountNetworkSwitcher } from '../components.js';
import { renderQrInto } from '../qr.js';
import { notify } from '../toast.js';

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();

  let networkId = NETWORKS[0].id;
  let assets = null;
  let simAmount = '0.05';
  let simulating = false;

  function render() {
    const net = getNetwork(networkId);
    const address = assets?.[networkId]?.address ?? '';

    content.innerHTML = `
      <div class="page-header">
        <div><span class="page-eyebrow">Simulated deposit</span><h1>Receive</h1></div>
        <div id="networkSwitcher"></div>
      </div>

      <div class="dashboard-grid">
        <div class="glass-card" style="display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;">
          ${networkIconHtml(networkId, 44)}
          <span class="page-eyebrow">${net.name} address</span>
          <div class="qr-frame"><canvas id="qrCanvas"></canvas></div>
          <div class="asset-detail__address" style="max-width:340px;">
            <span class="mono" id="addrText">${address}</span>
            ${copyButtonHtml('addrText')}
          </div>
          <p class="auth-sub">Only send simulated ${net.name} assets to this address. This is a demo address, not a real one.</p>
        </div>

        <div class="glass-card">
          <h3>Simulate incoming payment</h3>
          <p class="auth-sub" style="margin-bottom:16px;">For testing — instantly credits your demo balance and creates a received transaction.</p>
          <label class="field">
            <span>Amount (${net.symbol})</span>
            <input type="number" step="any" id="simAmount" value="${simAmount}" />
          </label>
          <button class="btn btn--primary btn--block" id="simulateBtn" ${simulating ? 'disabled' : ''}>
            ${simulating ? 'Simulating…' : `Simulate receiving ${net.symbol}`}
          </button>
        </div>
      </div>
    `;

    mountNetworkSwitcher(
      content.querySelector('#networkSwitcher'),
      networkId,
      (val) => {
        networkId = val;
        render();
      },
      { includeAll: false }
    );

    wireCopyButtons(content, { onCopied: () => notify('Address copied') });
    renderQrInto(content.querySelector('#qrCanvas'), address);

    content.querySelector('#simAmount').addEventListener('input', (e) => {
      simAmount = e.target.value;
    });
    content.querySelector('#simulateBtn').addEventListener('click', async () => {
      const amt = parseFloat(simAmount);
      if (!amt || amt <= 0) {
        notify('Enter an amount greater than zero', { type: 'error' });
        return;
      }
      simulating = true;
      render();
      try {
        await simulateIncomingPayment(user.uid, { networkId, amount: amt });
        notify(`Simulated ${amt} ${net.symbol} received`);
      } catch (err) {
        notify(err.message, { type: 'error' });
      } finally {
        simulating = false;
        render();
      }
    });
  }

  render();

  const unsub = subscribeToPortfolio(user.uid, (data) => {
    assets = data.assets || {};
    render();
  });

  return () => unsub();
}

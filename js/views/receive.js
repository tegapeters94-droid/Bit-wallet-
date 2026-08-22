// js/views/receive.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, simulateIncomingPayment, ensureAssetEntry } from '../wallet.js';
import { NETWORKS, getNetwork } from '../networks.js';
import { networkIconHtml, copyButtonHtml, wireCopyButtons, mountNetworkSwitcher } from '../components.js';
import { renderQrInto } from '../qr.js';
import { onPricesUpdated } from '../pricing.js';
import { notify } from '../toast.js';

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();

  let networkId = NETWORKS[0].id;
  let assets = null;
  let addAmount = '0.05';
  let submitting = false;

  function render() {
    const net = getNetwork(networkId);
    const address = assets?.[networkId]?.address ?? '';

    // A token created after this account already existed won't have an
    // address entry yet — generate one on the fly the first time it's viewed.
    if (assets && !address) {
      ensureAssetEntry(user.uid, networkId).catch(() => {});
    }

    content.innerHTML = `
      <div class="page-header">
        <h1>Receive</h1>
        <div id="networkSwitcher"></div>
      </div>

      <div class="dashboard-grid">
        <div class="card" style="display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;">
          ${networkIconHtml(networkId, 44)}
          <span class="page-eyebrow">${net.name} address</span>
          <div class="qr-frame"><canvas id="qrCanvas"></canvas></div>
          <div class="asset-detail__address" style="max-width:340px;">
            <span class="mono" id="addrText">${address}</span>
            ${copyButtonHtml('addrText')}
          </div>
          <p class="auth-sub">Only send ${net.name} assets to this address. Sending assets from a different network may result in permanent loss.</p>
        </div>

        <div class="card">
          <h3>Add funds</h3>
          <p class="auth-sub" style="margin-bottom:16px;">Credit this wallet to try out the portfolio and activity views.</p>
          <label class="field">
            <span>Amount (${net.symbol})</span>
            <input type="number" step="any" id="addAmount" value="${addAmount}" />
          </label>
          <button class="btn btn--primary btn--block" id="addFundsBtn" ${submitting ? 'disabled' : ''}>
            ${submitting ? 'Adding…' : `Add ${net.symbol}`}
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

    content.querySelector('#addAmount').addEventListener('input', (e) => {
      addAmount = e.target.value;
    });
    content.querySelector('#addFundsBtn').addEventListener('click', async () => {
      const amt = parseFloat(addAmount);
      if (!amt || amt <= 0) {
        notify('Enter an amount greater than zero', { type: 'error' });
        return;
      }
      submitting = true;
      render();
      try {
        await simulateIncomingPayment(user.uid, { networkId, amount: amt });
        notify(`${amt} ${net.symbol} received`);
      } catch (err) {
        notify(err.message, { type: 'error' });
      } finally {
        submitting = false;
        render();
      }
    });
  }

  render();

  const unsub = subscribeToPortfolio(user.uid, (data) => {
    assets = data.assets || {};
    render();
  });
  const unsubPrices = onPricesUpdated(render);

  return () => {
    unsub();
    unsubPrices();
  };
}

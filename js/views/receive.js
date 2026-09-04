// js/views/receive.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, ensureAssetEntry, getBlockedActions } from '../wallet.js';
import { NETWORKS, getNetwork } from '../networks.js';
import { networkIconHtml, copyButtonHtml, wireCopyButtons, mountNetworkSwitcher, emptyStateHtml } from '../components.js';
import { renderQrInto } from '../qr.js';
import { notify } from '../toast.js';
import { onPricesUpdated } from '../pricing.js';

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();

  let networkId = NETWORKS[0].id;
  let assets = null;
  let restriction = null; // null while loading, then { blocked, reason }

  function render() {
    if (restriction?.blocked) {
      content.innerHTML = `
        <div class="page-header"><h1>Receive</h1></div>
        <div class="card">
          ${emptyStateHtml({
            icon: '⛔',
            title: 'Receiving is currently restricted',
            message: restriction.reason || 'Contact support for more information.',
          })}
        </div>
      `;
      return;
    }

    const net = getNetwork(networkId);
    const address = assets?.[networkId]?.address ?? '';

    if (assets && !address) {
      ensureAssetEntry(user.uid, networkId).catch(() => {});
    }

    content.innerHTML = `
      <div class="page-header">
        <h1>Receive</h1>
        <div id="networkSwitcher"></div>
      </div>

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
  }

  getBlockedActions(user.uid).then((blocked) => {
    restriction = blocked.receive;
    render();
  });

  const unsub = subscribeToPortfolio(user.uid, (data) => {
    assets = data.assets || {};
    if (!restriction?.blocked) render();
  });
  const unsubPrices = onPricesUpdated(() => {
    if (!restriction?.blocked) render();
  });

  return () => {
    unsub();
    unsubPrices();
  };
}

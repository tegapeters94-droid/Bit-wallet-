// js/views/settings.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, regenerateAddress, resetPortfolio } from '../wallet.js';
import { NETWORKS } from '../networks.js';
import { networkIconHtml } from '../components.js';
import { notify } from '../toast.js';

const PLACEHOLDER_PHRASE = ['orbit', 'canvas', 'maple', 'lantern', 'ember', 'quartz', 'ridge', 'harbor', 'meadow', 'signal', 'anchor', 'willow'];

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();

  let assets = null;
  let showPhrase = false;
  let resetOpen = false;
  let resetting = false;
  let regeneratingId = null;
  let aboutOpen = false;

  function render() {
    content.innerHTML = `
      <div class="page-header"><h1>Settings</h1></div>

      <section class="card">
        <h3>Wallet addresses</h3>
        <p class="auth-sub" style="margin-bottom:16px;">Generate a new receiving address for any network.</p>
        <div class="settings-address-list">
          ${NETWORKS.map(
            (n) => `
            <div class="settings-address-row">
              ${networkIconHtml(n.id, 34)}
              <div class="settings-address-row__main">
                <strong>${n.name}</strong>
                <span class="mono">${assets?.[n.id]?.address ?? ''}</span>
              </div>
              <button class="btn btn--ghost" data-regen="${n.id}" ${regeneratingId === n.id ? 'disabled' : ''}>
                ${regeneratingId === n.id ? 'Generating…' : 'New address'}
              </button>
            </div>`
          ).join('')}
        </div>
      </section>

      <section class="card">
        <h3>Recovery phrase</h3>
        <p class="auth-sub" style="margin-bottom:16px;">
          Keep this phrase private — anyone with it can access this wallet. Never share it or enter it anywhere except here.
        </p>
        ${
          !showPhrase
            ? `<button class="btn btn--ghost" id="revealPhraseBtn">Reveal recovery phrase</button>`
            : `<div class="recovery-grid">${PLACEHOLDER_PHRASE.map((w, i) => `<div class="recovery-word"><span>${i + 1}</span>${w}</div>`).join('')}</div>`
        }
      </section>

      <section class="card">
        <h3 style="color:var(--danger);">Danger zone</h3>
        <p class="auth-sub" style="margin-bottom:16px;">Reset this wallet's balances to their starting values and clear all activity.</p>
        ${
          !resetOpen
            ? `<button class="btn btn--danger" id="openResetBtn">Reset wallet</button>`
            : `<div class="card" style="background:var(--danger-soft);border:1px solid rgba(255,107,107,0.3);">
                <p style="margin-bottom:12px;">This clears all activity and resets balances. This can't be undone.</p>
                <div class="send-confirm__actions">
                  <button class="btn btn--ghost btn--block" id="cancelResetBtn">Cancel</button>
                  <button class="btn btn--danger btn--block" id="confirmResetBtn" ${resetting ? 'disabled' : ''}>${resetting ? 'Resetting…' : 'Confirm reset'}</button>
                </div>
              </div>`
        }
      </section>

      <section class="card">
        <button class="settings-disclosure-toggle" id="aboutToggle">
          <h3>About Bitwallet</h3>
          <span class="settings-disclosure-toggle__chevron ${aboutOpen ? 'is-open' : ''}">▾</span>
        </button>
        ${
          aboutOpen
            ? `<div class="about-panel">
                <p>Bitwallet is a multi-chain wallet interface for managing digital assets across multiple networks.</p>
                <div class="about-panel__row"><span>Current environment</span><strong>Demonstration environment</strong></div>
                <p class="about-panel__disclosure">
                  Asset balances and transaction activity shown in this version are simulated and do not represent real funds or blockchain transactions.
                </p>
                <div class="about-panel__row"><span>Version</span><strong>1.0.0</strong></div>
              </div>`
            : ''
        }
      </section>
    `;

    content.querySelectorAll('[data-regen]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        regeneratingId = btn.getAttribute('data-regen');
        render();
        try {
          await regenerateAddress(user.uid, regeneratingId);
          notify('New address generated');
        } catch {
          notify('Could not generate a new address', { type: 'error' });
        } finally {
          regeneratingId = null;
          render();
        }
      });
    });

    content.querySelector('#revealPhraseBtn')?.addEventListener('click', () => {
      showPhrase = true;
      render();
    });

    content.querySelector('#openResetBtn')?.addEventListener('click', () => {
      resetOpen = true;
      render();
    });
    content.querySelector('#cancelResetBtn')?.addEventListener('click', () => {
      resetOpen = false;
      render();
    });
    content.querySelector('#confirmResetBtn')?.addEventListener('click', async () => {
      resetting = true;
      render();
      try {
        await resetPortfolio(user.uid);
        notify('Wallet reset to defaults');
        resetOpen = false;
      } catch {
        notify('Could not reset wallet', { type: 'error' });
      } finally {
        resetting = false;
        render();
      }
    });

    content.querySelector('#aboutToggle')?.addEventListener('click', () => {
      aboutOpen = !aboutOpen;
      render();
    });
  }

  render();

  const unsub = subscribeToPortfolio(user.uid, (data) => {
    assets = data.assets || {};
    render();
  });

  return () => unsub();
}

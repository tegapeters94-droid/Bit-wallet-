// js/views/settings.js
import { getState } from '../state.js';
import { renderShell } from '../shell.js';
import { subscribeToPortfolio, regenerateAddress, resetPortfolio } from '../wallet.js';
import { NETWORKS } from '../networks.js';
import { networkIconHtml } from '../components.js';
import { notify } from '../toast.js';

const DEMO_PHRASE = ['demo', 'sample', 'placeholder', 'wallet', 'simulate', 'testnet', 'preview', 'mockup', 'fixture', 'notreal', 'example', 'sandbox'];

export function mount(container) {
  const content = renderShell(container);
  const { user } = getState();

  let assets = null;
  let showPhrase = false;
  let resetOpen = false;
  let resetting = false;
  let regeneratingId = null;

  function render() {
    content.innerHTML = `
      <div class="page-header"><div><span class="page-eyebrow">Preferences</span><h1>Wallet settings</h1></div></div>

      <section class="glass-card">
        <h3>Simulated addresses</h3>
        <p class="auth-sub" style="margin-bottom:16px;">Regenerate the demo address shown for any network. This has no effect on any real blockchain.</p>
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
                ${regeneratingId === n.id ? 'Generating…' : 'Regenerate'}
              </button>
            </div>`
          ).join('')}
        </div>
      </section>

      <section class="glass-card">
        <h3>Recovery phrase (demo only)</h3>
        <p class="auth-sub" style="margin-bottom:16px;">
          This is a placeholder screen for UI demonstration. These words are synthetic and do not
          protect any real funds — Bitwallet never generates or stores real seed phrases.
        </p>
        ${
          !showPhrase
            ? `<button class="btn btn--ghost" id="revealPhraseBtn">Reveal demo phrase</button>`
            : `<div class="recovery-grid">${DEMO_PHRASE.map((w, i) => `<div class="recovery-word"><span>${i + 1}</span>${w}</div>`).join('')}</div>`
        }
      </section>

      <section class="glass-card">
        <h3 style="color:var(--danger);">Danger zone</h3>
        <p class="auth-sub" style="margin-bottom:16px;">Reset your demo portfolio back to its starting balances and clear all simulated transactions.</p>
        ${
          !resetOpen
            ? `<button class="btn btn--danger" id="openResetBtn">Reset demo portfolio</button>`
            : `<div class="glass-card" style="background:var(--danger-soft);border:1px solid rgba(242,73,92,0.3);">
                <p style="margin-bottom:12px;">This clears all transactions and resets balances. This can't be undone.</p>
                <div class="send-confirm__actions">
                  <button class="btn btn--ghost btn--block" id="cancelResetBtn">Cancel</button>
                  <button class="btn btn--danger btn--block" id="confirmResetBtn" ${resetting ? 'disabled' : ''}>${resetting ? 'Resetting…' : 'Confirm reset'}</button>
                </div>
              </div>`
        }
      </section>
    `;

    content.querySelectorAll('[data-regen]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        regeneratingId = btn.getAttribute('data-regen');
        render();
        try {
          await regenerateAddress(user.uid, regeneratingId);
          notify('New simulated address generated');
        } catch {
          notify('Could not regenerate address', { type: 'error' });
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
        notify('Demo portfolio reset to defaults');
        resetOpen = false;
      } catch {
        notify('Could not reset portfolio', { type: 'error' });
      } finally {
        resetting = false;
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

// js/views/forgotPassword.js
import { resetPassword, isFirebaseConfigured } from '../auth.js';

export function mount(container) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <a href="#/" class="landing__brand" style="margin-bottom:24px;">
          <span class="shell__brand-mark">B</span>Bitwallet
        </a>
        <h2>Reset your password</h2>
        <p class="auth-sub">We'll send a reset link to your email.</p>

        ${!isFirebaseConfigured ? `<div class="alert alert--warning">Firebase isn't configured yet. See README.md.</div>` : ''}
        <div id="resultBox"></div>

        <form id="resetForm" novalidate>
          <label class="field"><span>Email</span>
            <input id="email" type="email" placeholder="you@example.com" autocomplete="email" />
          </label>
          <button class="btn btn--primary btn--block" type="submit" ${!isFirebaseConfigured ? 'disabled' : ''} id="submitBtn">Send reset link</button>
        </form>

        <p class="auth-switch">Remembered it? <a href="#/login">Back to login</a></p>
      </div>
    </div>
  `;

  const form = container.querySelector('#resetForm');
  const submitBtn = container.querySelector('#submitBtn');
  const resultBox = container.querySelector('#resultBox');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#email').value.trim();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    try {
      await resetPassword(email);
    } catch {
      // Avoid confirming whether an email exists — generic message either way
    } finally {
      resultBox.innerHTML = `<div class="alert alert--success">If an account exists for that email, a reset link is on its way. Check your inbox.</div>`;
      form.style.display = 'none';
    }
  });
}

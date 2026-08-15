// js/views/login.js
import { login, isFirebaseConfigured } from '../auth.js';
import { notify } from '../toast.js';
import { navigate } from '../router.js';

function friendlyError(code) {
  const map = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Try again in a moment.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

export function mount(container) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <a href="#/" class="landing__brand" style="margin-bottom:24px;">
          <span class="shell__brand-mark">B</span>Bitwallet
        </a>
        <h2>Log in</h2>
        <p class="auth-sub">Access your simulated wallet portfolio.</p>

        ${!isFirebaseConfigured ? `<div class="alert alert--warning">Firebase isn't configured yet. Add your project keys in js/firebase.js to enable login. See README.md.</div>` : ''}
        <div id="formError"></div>

        <form id="loginForm" novalidate>
          <label class="field"><span>Email</span>
            <input id="email" type="email" placeholder="you@example.com" autocomplete="email" />
          </label>
          <label class="field"><span>Password</span>
            <input id="password" type="password" placeholder="••••••••" autocomplete="current-password" />
          </label>
          <div class="auth-row"><a href="#/forgot-password" class="auth-link">Forgot password?</a></div>
          <button class="btn btn--primary btn--block" type="submit" ${!isFirebaseConfigured ? 'disabled' : ''} id="submitBtn">Log in</button>
        </form>

        <p class="auth-switch">New to Bitwallet? <a href="#/signup">Create a wallet</a></p>
      </div>
    </div>
  `;

  const form = container.querySelector('#loginForm');
  const submitBtn = container.querySelector('#submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#email').value.trim();
    const password = container.querySelector('#password').value;
    container.querySelector('#formError').innerHTML = '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';
    try {
      await login({ email, password });
      notify('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      container.querySelector('#formError').innerHTML = `<div class="alert alert--error">${friendlyError(err.code)}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  });
}

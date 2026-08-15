// js/views/signup.js
import { signup, isFirebaseConfigured } from '../auth.js';
import { notify } from '../toast.js';
import { navigate } from '../router.js';

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Password should be at least 6 characters.',
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
        <h2>Create your wallet</h2>
        <p class="auth-sub">Simulated multi-chain wallet — no real funds involved.</p>

        ${!isFirebaseConfigured ? `<div class="alert alert--warning">Firebase isn't configured yet. Add your project keys in js/firebase.js to enable sign up. See README.md.</div>` : ''}
        <div id="formError"></div>

        <form id="signupForm" novalidate>
          <label class="field"><span>Full name</span>
            <input id="name" placeholder="Ada Okafor" autocomplete="name" />
            <span class="field__error" id="nameError"></span>
          </label>
          <label class="field"><span>Email</span>
            <input id="email" type="email" placeholder="you@example.com" autocomplete="email" />
            <span class="field__error" id="emailError"></span>
          </label>
          <label class="field"><span>Password</span>
            <input id="password" type="password" placeholder="••••••••" autocomplete="new-password" />
            <span class="field__error" id="passwordError"></span>
          </label>
          <label class="field"><span>Confirm password</span>
            <input id="confirm" type="password" placeholder="••••••••" autocomplete="new-password" />
            <span class="field__error" id="confirmError"></span>
          </label>
          <button class="btn btn--primary btn--block" type="submit" ${!isFirebaseConfigured ? 'disabled' : ''} id="submitBtn">Create wallet</button>
        </form>

        <p class="auth-switch">Already have a wallet? <a href="#/login">Log in</a></p>
      </div>
    </div>
  `;

  const form = container.querySelector('#signupForm');
  const submitBtn = container.querySelector('#submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#name').value.trim();
    const email = container.querySelector('#email').value.trim();
    const password = container.querySelector('#password').value;
    const confirm = container.querySelector('#confirm').value;

    ['nameError', 'emailError', 'passwordError', 'confirmError'].forEach((id) => {
      container.querySelector(`#${id}`).textContent = '';
    });
    container.querySelector('#formError').innerHTML = '';

    let hasError = false;
    if (!name) {
      container.querySelector('#nameError').textContent = 'Enter your name.';
      hasError = true;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      container.querySelector('#emailError').textContent = 'Enter a valid email.';
      hasError = true;
    }
    if (password.length < 6) {
      container.querySelector('#passwordError').textContent = 'Use at least 6 characters.';
      hasError = true;
    }
    if (password !== confirm) {
      container.querySelector('#confirmError').textContent = 'Passwords do not match.';
      hasError = true;
    }
    if (hasError) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating wallet…';
    try {
      await signup({ name, email, password });
      notify('Wallet created. Welcome to Bitwallet!');
      navigate('/dashboard');
    } catch (err) {
      container.querySelector('#formError').innerHTML = `<div class="alert alert--error">${friendlyError(err.code)}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create wallet';
    }
  });
}

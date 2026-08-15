// js/toast.js
// Lightweight toast notifications. Renders into a fixed-position stack
// that lives outside the router-controlled #app container so toasts
// survive page navigation.

let stack = null;

function ensureStack() {
  if (stack) return stack;
  stack = document.createElement('div');
  stack.className = 'toast-stack';
  stack.setAttribute('role', 'status');
  stack.setAttribute('aria-live', 'polite');
  document.body.appendChild(stack);
  return stack;
}

/**
 * notify(message, { type: 'success' | 'error' | 'info', duration })
 */
export function notify(message, { type = 'success', duration = 3800 } = {}) {
  const el = ensureStack();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span class="toast__icon">${icon}</span><span></span>`;
  toast.querySelector('span:last-child').textContent = message;
  toast.addEventListener('click', () => toast.remove());
  el.appendChild(toast);
  window.setTimeout(() => toast.remove(), duration);
}

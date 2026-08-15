// js/router.js
// Static-host-compatible client-side routing using the URL hash (#/dashboard,
// #/asset/ethereum, etc.) — GitHub Pages just serves index.html for every
// path, and everything after the # never even reaches the server.

import { getState, subscribe } from './state.js';
import { notify } from './toast.js';

const routes = []; // { pattern: RegExp, keys: string[], guard, mount }
const appEl = () => document.getElementById('app');

let currentUnmount = null;

export function registerRoute(path, { guard = 'public', mount }) {
  const keys = [];
  const pattern = new RegExp(
    '^' +
      path
        .split('/')
        .map((seg) => {
          if (seg.startsWith(':')) {
            keys.push(seg.slice(1));
            return '([^/]+)';
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/') +
      '$'
  );
  routes.push({ pattern, keys, guard, mount });
}

function matchRoute(hashPath) {
  for (const route of routes) {
    const m = route.pattern.exec(hashPath);
    if (m) {
      const params = {};
      route.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(m[i + 1]);
      });
      return { route, params };
    }
  }
  return null;
}

function currentHashPath() {
  const hash = window.location.hash || '#/';
  const path = hash.slice(1); // strip '#'
  return path === '' ? '/' : path;
}

export function navigate(path) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}

async function render() {
  const path = currentHashPath();
  const matched = matchRoute(path);
  const container = appEl();

  if (typeof currentUnmount === 'function') {
    try {
      currentUnmount();
    } catch {
      // best-effort cleanup; a broken teardown shouldn't block navigation
    }
    currentUnmount = null;
  }

  if (!matched) {
    container.innerHTML = `
      <div class="full-spinner" style="flex-direction:column;gap:12px;">
        <h2>Page not found</h2>
        <a class="btn btn--primary" href="#/">Go home</a>
      </div>`;
    return;
  }

  const { route, params } = matched;
  const state = getState();

  if (route.guard === 'protected' && !state.user) {
    navigate('/login');
    return;
  }
  if (route.guard === 'admin') {
    if (!state.user) {
      navigate('/login');
      return;
    }
    if (!state.isAdmin) {
      notify('Admin access only', { type: 'error' });
      navigate('/dashboard');
      return;
    }
  }
  if (route.guard === 'guest-only' && state.user) {
    navigate('/dashboard');
    return;
  }

  container.innerHTML = '';
  const result = await route.mount(container, params);
  if (typeof result === 'function') currentUnmount = result;

  window.scrollTo(0, 0);
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  // Re-render whenever auth state changes (login/logout should re-evaluate
  // guarded routes immediately, not just on the next hash change).
  subscribe(render);
  render();
}

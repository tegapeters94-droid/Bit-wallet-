// js/app.js
// Entry point loaded by index.html as an ES module. Wires up Firebase auth
// state, registers every route, and starts the hash router.

import { initAuthListener } from './auth.js';
import { registerRoute, startRouter } from './router.js';

import * as landing from './views/landing.js';
import * as login from './views/login.js';
import * as signup from './views/signup.js';
import * as forgotPassword from './views/forgotPassword.js';
import * as dashboard from './views/dashboard.js';
import * as assets from './views/assets.js';
import * as assetDetail from './views/assetDetail.js';
import * as send from './views/send.js';
import * as receive from './views/receive.js';
import * as activity from './views/activity.js';
import * as settings from './views/settings.js';
import * as profile from './views/profile.js';
import * as admin from './views/admin.js';

registerRoute('/', { guard: 'public', mount: landing.mount });
registerRoute('/login', { guard: 'guest-only', mount: login.mount });
registerRoute('/signup', { guard: 'guest-only', mount: signup.mount });
registerRoute('/forgot-password', { guard: 'guest-only', mount: forgotPassword.mount });

registerRoute('/dashboard', { guard: 'protected', mount: dashboard.mount });
registerRoute('/assets', { guard: 'protected', mount: assets.mount });
registerRoute('/asset/:networkId', { guard: 'protected', mount: assetDetail.mount });
registerRoute('/send', { guard: 'protected', mount: send.mount });
registerRoute('/receive', { guard: 'protected', mount: receive.mount });
registerRoute('/activity', { guard: 'protected', mount: activity.mount });
registerRoute('/settings', { guard: 'protected', mount: settings.mount });
registerRoute('/profile', { guard: 'protected', mount: profile.mount });
registerRoute('/admin', { guard: 'admin', mount: admin.mount });

initAuthListener(() => {
  startRouter();
});

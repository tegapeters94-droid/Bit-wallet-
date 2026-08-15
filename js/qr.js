// js/qr.js
// Thin wrapper around the `qrcode` CDN library (loaded globally as
// `window.QRCode` in index.html) so views don't touch the global directly.

export function renderQrInto(canvas, text) {
  if (!window.QRCode) return;
  window.QRCode.toCanvas(canvas, text, { width: 188, margin: 1, color: { dark: '#f2f3f7', light: '#00000000' } }, (err) => {
    if (err) console.error('QR render failed', err);
  });
}

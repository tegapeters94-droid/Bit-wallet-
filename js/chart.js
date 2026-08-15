// js/chart.js
// A small canvas-drawn area chart replacing the React version's recharts
// component. Builds a deterministic simulated 7-day trend ending at the
// current total portfolio value, so the chart feels alive without storing
// historical snapshots.

function buildTrend(total, change24h) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date().getDay();
  const ordered = [...days.slice(today + 1), ...days.slice(0, today + 1)];
  const startValue = total / (1 + change24h / 100 || 1);
  return ordered.map((day, i) => {
    const t = i / (ordered.length - 1);
    const noise = Math.sin(i * 1.7) * total * 0.015;
    const value = startValue + (total - startValue) * t + noise;
    return { day, value: Math.max(0, value) };
  });
}

/**
 * renderPortfolioChart(canvas, total, change24h)
 * Draws directly onto a <canvas> element sized to its CSS box, with
 * devicePixelRatio scaling for crisp lines on retina displays.
 */
export function renderPortfolioChart(canvas, total, change24h) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.parentElement.clientWidth || 400;
  const height = 180;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const data = buildTrend(total, change24h);
  const positive = change24h >= 0;
  const color = positive ? '#00d9c0' : '#f2495c';

  const padTop = 12;
  const padBottom = 26;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xFor = (i) => (i / (data.length - 1)) * width;
  const yFor = (v) => padTop + (1 - (v - min) / range) * (height - padTop - padBottom);

  // Area fill
  const gradient = ctx.createLinearGradient(0, padTop, 0, height - padBottom);
  gradient.addColorStop(0, `${color}59`);
  gradient.addColorStop(1, `${color}00`);

  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xFor(i);
    const y = yFor(d.value);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(width, height - padBottom);
  ctx.lineTo(0, height - padBottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xFor(i);
    const y = yFor(d.value);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Day labels
  ctx.fillStyle = '#5c6379';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'center';
  data.forEach((d, i) => {
    ctx.fillText(d.day, xFor(i), height - 6);
  });
}

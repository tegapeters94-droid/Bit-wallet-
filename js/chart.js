// js/chart.js
// A small canvas-drawn area chart used for the portfolio balance and
// per-asset price charts. Builds a deterministic simulated trend line for
// whichever time range is selected, ending at the current total value, so
// the chart feels alive without needing a real historical data feed.

export const CHART_RANGES = ['1H', '1D', '1W', '1M', '1Y', 'ALL'];

function labelsFor(range) {
  const now = new Date();
  switch (range) {
    case '1H': {
      const labels = [];
      for (let i = 5; i >= 0; i -= 1) {
        const t = new Date(now.getTime() - i * 10 * 60 * 1000);
        labels.push(i === 0 ? 'Now' : t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
      }
      return labels;
    }
    case '1D': {
      const labels = [];
      for (let i = 6; i >= 0; i -= 1) {
        const t = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
        labels.push(i === 0 ? 'Now' : t.toLocaleTimeString(undefined, { hour: 'numeric' }));
      }
      return labels;
    }
    case '1W': {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const today = now.getDay();
      return [...days.slice(today + 1), ...days.slice(0, today + 1)];
    }
    case '1M':
      return ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Now'];
    case '1Y': {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const m = now.getMonth();
      return [...months.slice(m + 1), ...months.slice(0, m + 1)];
    }
    case 'ALL':
    default:
      return ['2023', '2024', '2025', '2026', 'Now'];
  }
}

// How much the line wanders per range — shorter ranges are calmer,
// longer ranges show more visible growth/volatility.
const VOLATILITY = { '1H': 0.006, '1D': 0.015, '1W': 0.03, '1M': 0.06, '1Y': 0.16, ALL: 0.32 };

function buildTrend(total, change24h, range) {
  const labels = labelsFor(range);
  const volatility = VOLATILITY[range] ?? 0.03;
  const startValue = Math.max(0, total * (1 - volatility * (0.6 + Math.abs(change24h) / 20)));

  return labels.map((label, i) => {
    const t = i / (labels.length - 1);
    const noise = Math.sin(i * 1.9 + range.length) * total * (volatility * 0.18);
    const value = startValue + (total - startValue) * t + noise;
    return { label, value: Math.max(0, value) };
  });
}

/**
 * renderPortfolioChart(canvas, total, change24h, range)
 * Draws directly onto a <canvas> element sized to its CSS box, with
 * devicePixelRatio scaling for crisp lines on retina displays.
 */
export function renderPortfolioChart(canvas, total, change24h, range = '1D') {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.parentElement.clientWidth || 400;
  const height = rect.height || 160;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const data = buildTrend(total, change24h, range);
  const positive = change24h >= 0;
  const color = positive ? '#3ddc97' : '#ff6b6b';

  const padTop = 10;
  const padBottom = 22;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range_ = max - min || 1;

  const xFor = (i) => (i / (data.length - 1)) * width;
  const yFor = (v) => padTop + (1 - (v - min) / range_) * (height - padTop - padBottom);

  const gradient = ctx.createLinearGradient(0, padTop, 0, height - padBottom);
  gradient.addColorStop(0, `${color}40`);
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

  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xFor(i);
    const y = yFor(d.value);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.25;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  data.forEach((d, i) => {
    if (data.length > 7 && i % 2 !== 0 && i !== data.length - 1) return;
    ctx.fillText(d.label, xFor(i), height - 6);
  });
}

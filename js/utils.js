/**
 * utils.js
 * Small shared helpers used across the log/dashboard pages.
 */

function todayISO() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

function formatDateShort(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

// rows: array of arrays, first row is the header.
function downloadCSV(filename, rows) {
  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Small icon set for row-action buttons, shared across pages.
const ICON_SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICON_PLUS = `<svg ${ICON_SVG_ATTRS}><path d="M12 5v14"/><path d="M5 12h14"/></svg>`;
const ICON_COPY = `<svg ${ICON_SVG_ATTRS}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_EDIT = `<svg ${ICON_SVG_ATTRS}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICON_TRASH = `<svg ${ICON_SVG_ATTRS}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
const ICON_CHEVRON = `<svg ${ICON_SVG_ATTRS}><path d="M9 6l6 6-6 6"/></svg>`;

// Small filled canvas icons used as Chart.js point markers (cardio/strength
// day indicators on calorie trend charts). Chart.js draws image/canvas
// pointStyle values directly, so these need to be actual canvases, not SVG.
function iconCanvas(size, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  drawFn(canvas.getContext('2d'), size);
  return canvas;
}

function dumbbellIconCanvas(size, color) {
  return iconCanvas(size, (ctx, s) => {
    ctx.fillStyle = color;
    const plateW = s * 0.16, plateH = s * 0.5, plateY = s * 0.25;
    ctx.fillRect(s * 0.04, plateY, plateW, plateH);
    ctx.fillRect(s * 0.80, plateY, plateW, plateH);
    ctx.fillRect(s * 0.20, s * 0.44, s * 0.60, s * 0.12);
  });
}

function shoeIconCanvas(size, color) {
  return iconCanvas(size, (ctx, s) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 0.06, s * 0.80);
    ctx.bezierCurveTo(s * 0.02, s * 0.62, s * 0.10, s * 0.48, s * 0.26, s * 0.46);
    ctx.lineTo(s * 0.48, s * 0.32);
    ctx.bezierCurveTo(s * 0.60, s * 0.22, s * 0.78, s * 0.22, s * 0.88, s * 0.34);
    ctx.bezierCurveTo(s * 0.96, s * 0.42, s * 0.94, s * 0.56, s * 0.86, s * 0.62);
    ctx.lineTo(s * 0.90, s * 0.80);
    ctx.closePath();
    ctx.fill();
  });
}

// Maps logged_at -> { cardio, strength } from a set of exercise_entries rows.
function buildDayActivity(exercises) {
  const map = {};
  (exercises || []).forEach(e => {
    if (!map[e.logged_at]) map[e.logged_at] = { cardio: false, strength: false };
    if (e.category === 'cardio') map[e.logged_at].cardio = true;
    else map[e.logged_at].strength = true; // lifting or core
  });
  return map;
}

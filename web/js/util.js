// Pomoćne funkcije: HTML, datumi (dd.mm.yyyy., 24h), brojevi sa decimalnim zarezom, srpska množina.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- Datumi (lokalno vreme, bez vremenskih zona u bazi) ----------

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' ili 'YYYY-MM-DDTHH:mm' → Date (lokalno). */
export function parseDate(v) {
  if (v instanceof Date) return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v || '');
  if (!m) return new Date(NaN);
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
}

export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isoDateTime = (d) => `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const nowISO = () => new Date().toISOString();

export function fmtDate(v) {
  const d = parseDate(v);
  return isNaN(d) ? '—' : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
}
export function fmtTime(v) {
  const d = parseDate(v);
  return isNaN(d) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fmtDateTime = (v) => `${fmtDate(v)} ${fmtTime(v)}`;

/** ISO trenutak (createdAt/updatedAt) → dd.mm.yyyy. HH:mm */
export function fmtStamp(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '—' : `${fmtDate(d)} ${fmtTime(d)}`;
}

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  r.setDate(r.getDate() + n);
  return r;
}
/** Broj kalendarskih dana od a do b. */
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);

// ---------- Brojevi ----------

export function fmtNumber(x) {
  if (x === null || x === undefined || x === '' || isNaN(x)) return '';
  return String(Math.round(Number(x) * 100) / 100).replace('.', ',');
}
export function parseDecimal(s) {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
export const fmtPower = (kw) => (kw === null || kw === undefined || kw === '' ? '—' : `${fmtNumber(kw)} kW`);

// ---------- Srpska množina ----------

export function daysWord(n) {
  const a = Math.abs(n);
  return `${a} ${a % 10 === 1 && a % 100 !== 11 ? 'dan' : 'dana'}`;
}
export function photosWord(n) {
  const a = n % 100;
  const last = n % 10;
  const w = last >= 2 && last <= 4 && !(a >= 12 && a <= 14) ? 'fotografije' : 'fotografija';
  return `${n} ${w}`;
}
export function reportsWord(n) {
  const a = n % 100;
  const last = n % 10;
  if (last === 1 && a !== 11) return `${n} izveštaj`;
  return `${n} izveštaja`;
}
export function dueText(days) {
  if (days < 0) return `Kasni ${daysWord(days)}`;
  if (days === 0) return 'Rok je danas';
  if (days === 1) return 'Rok je sutra';
  return `Za ${daysWord(days)}`;
}
export function durationText(min) {
  const m = Number(min) || 0;
  if (m <= 0) return '—';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}
export function bytesText(b) {
  if (!b) return '0 KB';
  if (b < 1024 * 1024) return `${fmtNumber(b / 1024).split(',')[0]} KB`;
  return `${fmtNumber(Math.round((b / 1024 / 1024) * 10) / 10)} MB`;
}

// ---------- Tekst ----------

/** Mala slova bez dijakritika i znakova – za poređenje zaglavlja CSV-a. */
export function normalizedKey(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
/** Pretraga bez obzira na velika slova i dijakritike. */
export function matches(haystack, needle) {
  const n = normalizedKey(needle);
  if (!n) return true;
  return haystack.some((h) => normalizedKey(h).includes(n));
}
export const compareTag = (a, b) => a.localeCompare(b, 'sr', { numeric: true, sensitivity: 'base' });

export function debounce(fn, ms) {
  let t = null;
  const d = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => { t = null; fn(...args); }, ms);
  };
  d.flush = (...args) => { if (t) { clearTimeout(t); t = null; fn(...args); } };
  return d;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bezbedan pristup localStorage-u (može biti nedostupan). */
export const prefs = {
  get(key, def = null) {
    try { const v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); } catch { return def; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignoriši */ }
  },
};

export function autoGrow(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(textarea.scrollHeight, 80)}px`;
}

// Zajednički delovi interfejsa: navigacija, oznake, dijalozi, obaveštenja, deljenje fajlova, sličice.

import { esc, bytesText } from './util.js';
import { icon } from './icons.js';
import { DUE, reportStatus, photoData, onPhotoDeleted } from './store.js';

// ---------- Navigacija ----------

/** Gornja traka. back: { label, fallback } ; right/left: HTML dugmadi. */
export function navBar({ title = '', back = null, left = '', right = '', alwaysTitle = false } = {}) {
  const backHtml = back
    ? `<button type="button" class="nav-btn" data-nav-back="${esc(back.fallback || '#/')}">${icon('chevronLeft')}<span>${esc(back.label || 'Nazad')}</span></button>`
    : left;
  return `<header class="nav ${alwaysTitle ? 'always-title' : ''}">
    <div class="nav-inner">
      <div class="nav-left">${backHtml}</div>
      <div class="nav-title">${esc(title)}</div>
      <div class="nav-right">${right}</div>
    </div>
  </header>`;
}

export const largeTitle = (text, sub = '') =>
  `<h1 class="large-title">${esc(text)}</h1>${sub ? `<div class="subtitle">${esc(sub)}</div>` : ''}`;

export const actionBar = (inner, hint = '') =>
  `<div class="actionbar"><div class="actionbar-inner">${inner}</div>${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;

// ---------- Oznake (boja uvek uz ikonu i tekst) ----------

export const badge = (text, iconName, tone = 'neutral') =>
  `<span class="badge tone-${tone}">${icon(iconName)}${esc(text)}</span>`;

export const dueBadge = (state, text) => badge(text || DUE[state].title, DUE[state].icon, DUE[state].tone);

export function reportBadge(r) {
  if (r.isDraft) return badge('Nacrt', 'draft', 'neutral');
  const s = reportStatus(r.status);
  return badge(s.title, s.icon, s.tone);
}

export function choices(name, options, selected) {
  return `<div class="choices" role="group" data-choice="${esc(name)}">${options.map((o) =>
    `<button type="button" class="choice" data-value="${esc(o.id)}" aria-pressed="${o.id === selected}">${
      o.id === selected ? icon('check') : o.icon ? icon(o.icon) : ''}${esc(o.title)}</button>`).join('')}</div>`;
}

/** Ažurira izgled grupe izbora bez ponovnog crtanja ekrana. */
export function setChoice(groupEl, value, options) {
  groupEl.querySelectorAll('.choice').forEach((b) => {
    const on = b.dataset.value === value;
    b.setAttribute('aria-pressed', String(on));
    const o = options.find((x) => x.id === b.dataset.value);
    b.innerHTML = `${on ? icon('check') : o?.icon ? icon(o.icon) : ''}${esc(o?.title || '')}`;
  });
}

export const emptyState = (iconName, title, text = '') =>
  `<div class="empty">${icon(iconName)}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}</div>`;

// ---------- Dijalozi ----------

const overlays = () => document.getElementById('overlays');

/**
 * Dijalog sa dugmadima. buttons: [{ label, value, style: 'primary'|'danger'|'cancel' }]
 * Vraća value izabranog dugmeta (ili null za otkazivanje).
 */
export function dialog({ title, message = '', buttons, bottom = false }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = `backdrop ${bottom ? 'bottom' : ''}`;
    el.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">${esc(title)}</h2>${message ? `<p>${esc(message)}</p>` : ''}
      <div class="btns">${buttons.map((b, i) => `<button type="button" class="btn btn-block ${
        b.style === 'primary' ? 'btn-primary' : b.style === 'danger' ? 'btn-danger-fill' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>
    </div>`;
    const close = (value) => {
      el.remove();
      document.body.classList.toggle('modal-open', overlays().children.length > 0);
      resolve(value);
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) close(buttons[+b.dataset.i].value ?? null);
      else if (e.target === el) close(null);
    });
    overlays().appendChild(el);
    document.body.classList.add('modal-open');
    el.querySelector('[data-i]')?.focus({ preventScroll: true });
  });
}

export const confirmDialog = ({ title, message, confirm, destructive = true }) =>
  dialog({
    title, message,
    buttons: [
      { label: confirm, value: true, style: destructive ? 'danger' : 'primary' },
      { label: 'Otkaži', value: false, style: 'cancel' },
    ],
  }).then((v) => v === true);

export const alertDialog = (title, message = '') =>
  dialog({ title, message, buttons: [{ label: 'U redu', value: true, style: 'primary' }] });

export function toast(message, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** Prikazuje indikator dok traje posao. */
export async function busy(text, work) {
  const el = document.createElement('div');
  el.className = 'busy';
  el.innerHTML = `<div><span class="spinner"></span><span>${esc(text)}</span></div>`;
  document.body.appendChild(el);
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return await work();
  } finally {
    el.remove();
  }
}

/**
 * Nudi gotov fajl: "Podeli" (iOS share sheet → Sačuvaj u Fajlove, Mail, Viber…) ili "Otvori / preuzmi".
 * Deljenje ide na novi dodir korisnika – iOS to zahteva.
 */
export async function offerFile(blob, fileName, title) {
  const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const buttons = [];
  if (canShare) buttons.push({ label: 'Podeli / Sačuvaj u Fajlove', value: 'share', style: 'primary' });
  buttons.push({ label: 'Otvori / preuzmi', value: 'open', style: canShare ? '' : 'primary' });
  buttons.push({ label: 'Zatvori', value: null });
  const choice = await dialog({ title, message: `${fileName}\n${bytesText(blob.size)}`, buttons, bottom: true });
  if (choice === 'share') {
    try {
      await navigator.share({ files: [file], title: fileName });
    } catch (e) {
      if (e?.name !== 'AbortError') downloadBlob(blob, fileName);
    }
  } else if (choice === 'open') {
    downloadBlob(blob, fileName);
  }
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---------- Sličice i slike iz baze ----------

const urlCache = new Map();

export async function photoURL(id, kind = 'thumb') {
  const key = `${id}:${kind}`;
  if (urlCache.has(key)) return urlCache.get(key);
  const data = await photoData(id);
  const blob = data?.[kind];
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

onPhotoDeleted((id) => {
  for (const kind of ['thumb', 'full']) {
    const key = `${id}:${kind}`;
    if (urlCache.has(key)) { URL.revokeObjectURL(urlCache.get(key)); urlCache.delete(key); }
  }
});

export const thumbImg = (photoId, alt = '') =>
  `<img data-photo="${esc(photoId)}" data-kind="thumb" alt="${esc(alt)}" decoding="async">`;

/** Popunjava sve <img data-photo> u elementu. */
export function hydratePhotos(root) {
  root.querySelectorAll('img[data-photo]').forEach(async (img) => {
    const url = await photoURL(img.dataset.photo, img.dataset.kind || 'thumb');
    if (url) img.src = url;
  });
}

/** Spaja izabrane fajlove iz globalnih <input type="file"> sa ekranom koji ih trenutno čeka. */
const fileHandlers = {};
export function onFiles(inputId, handler) { fileHandlers[inputId] = handler; }
export function initFileInputs() {
  for (const id of ['file-camera', 'file-gallery', 'file-csv', 'file-backup']) {
    const input = document.getElementById(id);
    input.addEventListener('change', async () => {
      const files = [...input.files];
      input.value = '';
      if (files.length && fileHandlers[id]) await fileHandlers[id](files);
    });
  }
}

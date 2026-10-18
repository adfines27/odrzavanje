// Pregled fotografija preko celog ekrana: zumiranje prstima, dvostruki dodir, prevlačenje levo/desno,
// a u izmeni i oznaka Pre/Posle/Ostalo, opis i brisanje.

import { S, photosOf, PHOTO_LABELS, savePhotoMeta, deletePhoto } from '../store.js';
import { photoURL, choices, setChoice, confirmDialog } from '../ui.js';
import { icon } from '../icons.js';
import { esc, debounce } from '../util.js';

function mountOverlay(html) {
  const root = document.createElement('div');
  root.className = 'viewer';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = html;
  document.getElementById('overlays').appendChild(root);
  document.body.classList.add('modal-open');
  return () => {
    root.remove();
    document.body.classList.toggle('modal-open', document.getElementById('overlays').children.length > 0);
  };
}

/** Zumiranje i pomeranje slike unutar "stage" elementa (Pointer Events). */
function zoomable(stage, img, { onSwipe }) {
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const pointers = new Map();
  let start = null;
  let lastTap = 0;

  const base = () => {
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;
    const fit = Math.min(sw / iw, sh / ih);
    return { sw, sh, w: iw * fit, h: ih * fit };
  };
  const clamp = () => {
    const b = base();
    const maxX = Math.max(0, (b.w * scale - b.sw) / 2);
    const maxY = Math.max(0, (b.h * scale - b.sh) / 2);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  };
  const apply = (animate = false) => {
    const b = base();
    img.style.width = `${b.w}px`;
    img.style.height = `${b.h}px`;
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
    img.style.transition = animate ? 'transform 0.2s ease-out' : 'none';
    img.style.transform = `translate(${-b.w / 2 + tx}px, ${-b.h / 2 + ty}px) scale(${scale})`;
    img.style.transformOrigin = `${b.w / 2}px ${b.h / 2}px`;
  };
  const reset = () => { scale = 1; tx = 0; ty = 0; apply(true); };

  /** Središte dva prsta u odnosu na centar prikaza. */
  const center = (a, b) => {
    const rect = stage.getBoundingClientRect();
    return { x: (a.x + b.x) / 2 - rect.left - rect.width / 2, y: (a.y + b.y) / 2 - rect.top - rect.height / 2 };
  };

  const zoomAt = (newScale, cx, cy) => {
    const s = Math.min(6, Math.max(1, newScale));
    const rect = stage.getBoundingClientRect();
    const px = cx - rect.left - rect.width / 2;
    const py = cy - rect.top - rect.height / 2;
    tx = px - ((px - tx) * s) / scale;
    ty = py - ((py - ty) * s) / scale;
    scale = s;
    clamp();
  };

  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) start = { x: e.clientX, y: e.clientY, tx, ty, t: Date.now() };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const c = center(a, b);
      start = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale, cx: c.x, cy: c.y, tx, ty };
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && start?.dist) {
      // Tačka sadržaja koja je bila ispod prstiju ostaje ispod prstiju.
      const [a, b] = [...pointers.values()];
      const c = center(a, b);
      const s = Math.min(6, Math.max(1, start.scale * (Math.hypot(a.x - b.x, a.y - b.y) / start.dist)));
      tx = c.x - ((start.cx - start.tx) * s) / start.scale;
      ty = c.y - ((start.cy - start.ty) * s) / start.scale;
      scale = s;
      clamp();
      apply();
    } else if (pointers.size === 1 && start && !start.dist && scale > 1) {
      tx = start.tx + (e.clientX - start.x);
      ty = start.ty + (e.clientY - start.y);
      clamp();
      apply();
    }
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size === 0 && start && !start.dist) {
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      const dt = Date.now() - start.t;
      if (scale <= 1.01 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        onSwipe(dx < 0 ? 1 : -1);
      } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
        const now = Date.now();
        if (now - lastTap < 320) {
          if (scale > 1.01) reset();
          else { zoomAt(2.5, p.x, p.y); apply(true); }
          lastTap = 0;
        } else lastTap = now;
      }
      start = null;
    } else if (pointers.size === 1) {
      const [rest] = [...pointers.values()];
      start = { x: rest.x, y: rest.y, tx, ty, t: Date.now() };
      if (scale < 1.01) reset();
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  const onResize = () => { clamp(); apply(); };
  window.addEventListener('resize', onResize);
  img.addEventListener('load', () => apply());
  return { reset, destroy: () => window.removeEventListener('resize', onResize) };
}

/** Fotografije izveštaja. onChange se poziva posle izmene ili brisanja. */
export function openViewer({ reportId, index = 0, editable = false, onChange = () => {} }) {
  let photos = photosOf(reportId);
  if (!photos.length) return;
  let i = Math.min(index, photos.length - 1);

  const close = mountOverlay(`
    <div class="viewer-top">
      <button type="button" class="viewer-btn" data-close>${icon('x')}Zatvori</button>
      <span class="count" data-count></span>
      ${editable ? `<button type="button" class="viewer-btn danger" data-delete aria-label="Obriši fotografiju">${icon('trash')}</button>` : '<span style="width:48px"></span>'}
    </div>
    <div class="viewer-stage" data-stage>
      <img alt="" data-img draggable="false">
      <button type="button" class="viewer-nav prev" data-prev aria-label="Prethodna">${icon('chevronLeft')}</button>
      <button type="button" class="viewer-nav next" data-next aria-label="Sledeća">${icon('chevronRight')}</button>
    </div>
    <div class="viewer-bottom" data-bottom></div>`);
  const root = document.querySelector('#overlays .viewer:last-child');
  const img = root.querySelector('[data-img]');
  const bottom = root.querySelector('[data-bottom]');

  const saveCaption = debounce(async (p) => { await savePhotoMeta(p); onChange(); }, 400);

  const show = async () => {
    const p = photos[i];
    root.querySelector('[data-count]').textContent = `${i + 1} / ${photos.length}`;
    root.querySelector('[data-prev]').hidden = i === 0;
    root.querySelector('[data-next]').hidden = i === photos.length - 1;
    zoom.reset();
    img.removeAttribute('src');
    const url = await photoURL(p.id, 'full');
    if (photos[i] === p && url) img.src = url;
    if (editable) {
      bottom.innerHTML = `${choices('label', PHOTO_LABELS, p.label)}
        <textarea rows="1" data-caption placeholder="Opis fotografije (opciono)" aria-label="Opis fotografije">${esc(p.caption)}</textarea>`;
    } else {
      const lbl = PHOTO_LABELS.find((x) => x.id === p.label)?.title || '';
      bottom.innerHTML = `<span class="photo-label lbl-${p.label}" style="position:static">${esc(lbl.toUpperCase())}</span>
        ${p.caption ? `<p style="margin:8px 0 0">${esc(p.caption)}</p>` : ''}`;
    }
  };

  const go = (dir) => {
    const n = i + dir;
    if (n < 0 || n >= photos.length) return;
    saveCaption.flush(photos[i]);
    i = n;
    show();
  };
  const zoom = zoomable(root.querySelector('[data-stage]'), img, { onSwipe: go });

  const finish = () => {
    saveCaption.flush(photos[i]);
    zoom.destroy();
    close();
    onChange();
  };

  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) finish();
    else if (e.target.closest('[data-prev]')) go(-1);
    else if (e.target.closest('[data-next]')) go(1);
    else if (e.target.closest('.choice')) {
      const p = photos[i];
      p.label = e.target.closest('.choice').dataset.value;
      setChoice(bottom.querySelector('[data-choice]'), p.label, PHOTO_LABELS);
      await savePhotoMeta(p);
      onChange();
    } else if (e.target.closest('[data-delete]')) {
      const ok = await confirmDialog({ title: 'Obrisati fotografiju?', message: 'Fotografija će biti trajno obrisana sa uređaja.', confirm: 'Obriši fotografiju' });
      if (!ok) return;
      await deletePhoto(photos[i].id);
      photos = photosOf(reportId);
      onChange();
      if (!photos.length) { zoom.destroy(); close(); return; }
      i = Math.min(i, photos.length - 1);
      show();
    }
  });
  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-caption]')) {
      const p = photos[i];
      p.caption = e.target.value;
      saveCaption(p);
    }
  });
  show();
}

/** Glavna fotografija opreme. */
export function openSinglePhoto(photoId) {
  if (!photoId || !S.photos.has(photoId)) return;
  const close = mountOverlay(`
    <div class="viewer-top"><button type="button" class="viewer-btn" data-close>${icon('x')}Zatvori</button><span></span><span style="width:48px"></span></div>
    <div class="viewer-stage" data-stage><img alt="Fotografija opreme" data-img draggable="false"></div>`);
  const root = document.querySelector('#overlays .viewer:last-child');
  const img = root.querySelector('[data-img]');
  const zoom = zoomable(root.querySelector('[data-stage]'), img, { onSwipe: () => {} });
  photoURL(photoId, 'full').then((url) => { if (url) img.src = url; });
  root.querySelector('[data-close]').addEventListener('click', () => { zoom.destroy(); close(); });
}

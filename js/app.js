// Pokretanje aplikacije: učitavanje baze, primer podataka, ruter, tab bar, service worker.

import { loadAll, cleanupEmptyDrafts } from './store.js';
import { onDBBlocked } from './db.js';
import { seedIfNeeded } from './seed.js';
import { setRenderer, track, back, layoutView } from './router.js';
import { icon } from './icons.js';
import { hydratePhotos, initFileInputs, alertDialog } from './ui.js';
import { esc } from './util.js';
import { homeView, dueTasksView } from './views/home.js';
import { equipmentListView, equipmentDetailView, equipmentFormView, taskFormView } from './views/equipment.js';
import { reportListView, reportDetailView } from './views/reports.js';
import { reportFormView } from './views/reportForm.js';
import { settingsView } from './views/settings.js';
import { catalogView, catalogEditView, recommendedPlanView } from './views/catalog.js';

const routes = [
  [/^\/$/, () => homeView()],
  [/^\/zadaci\/(kasni|uskoro)$/, (m) => dueTasksView(m[1] === 'kasni' ? 'overdue' : 'soon')],
  [/^\/oprema$/, () => equipmentListView()],
  [/^\/oprema\/nova$/, () => equipmentFormView(null)],
  [/^\/oprema\/([\w-]+)$/, (m) => equipmentDetailView(m[1])],
  [/^\/oprema\/([\w-]+)\/izmena$/, (m) => equipmentFormView(m[1])],
  [/^\/oprema\/([\w-]+)\/zadatak$/, (m) => taskFormView(m[1], null)],
  [/^\/oprema\/([\w-]+)\/preporuceni-plan$/, (m) => recommendedPlanView(m[1])],
  [/^\/katalog$/, () => catalogView()],
  [/^\/katalog\/([\w-]+)$/, (m) => catalogEditView(m[1])],
  [/^\/zadatak\/([\w-]+)$/, (m) => taskFormView(null, m[1])],
  [/^\/izvestaji$/, (m, q) => reportListView(q)],
  [/^\/izvestaj\/([\w-]+)$/, (m) => reportDetailView(m[1])],
  [/^\/izvestaj\/([\w-]+)\/uredi$/, (m, q) => reportFormView(m[1], q.get('novi') === '1')],
  [/^\/podesavanja$/, () => settingsView()],
];

const TABS = [
  { id: 'home', href: '#/', label: 'Početna', icon: 'home' },
  { id: 'equipment', href: '#/oprema', label: 'Oprema', icon: 'equipment' },
  { id: 'reports', href: '#/izvestaji', label: 'Izveštaji', icon: 'doc' },
  { id: 'settings', href: '#/podesavanja', label: 'Podešavanja', icon: 'settings' },
];

const viewRoot = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const scrollPositions = new Map();
let current = null;
let currentHash = null;
let rendering = Promise.resolve();

function renderTabbar(active) {
  tabbar.innerHTML = TABS.map((t) =>
    `<a class="tab ${t.id === active ? 'active' : ''}" href="${t.href}" ${t.id === active ? 'aria-current="page"' : ''}>${icon(t.icon)}<span>${esc(t.label)}</span></a>`).join('');
}

async function doRender({ keepScroll = false, isBack = false } = {}) {
  const hash = location.hash || '#/';
  const [path, qs] = hash.slice(1).split('?');
  const query = new URLSearchParams(qs || '');

  const prevScroll = scroller()?.scrollTop || 0;
  if (currentHash) scrollPositions.set(currentHash, prevScroll);
  if (current?.leave) await current.leave();

  let view = null;
  for (const [re, handler] of routes) {
    const m = re.exec(path || '/');
    if (m) { view = await handler(m, query); break; }
  }
  if (!view) { location.replace('#/'); return; }
  if (view.redirect) { location.replace(view.redirect); return; }

  current = view;
  currentHash = hash;
  layoutView(view.el);
  viewRoot.replaceChildren(view.el);
  document.body.classList.toggle('no-tabbar', !!view.fullScreen);
  renderTabbar(view.tab);
  hydratePhotos(view.el);
  view.mounted?.();

  const y = keepScroll ? prevScroll : isBack ? scrollPositions.get(hash) || 0 : 0;
  const sc = scroller();
  if (sc) sc.scrollTop = y;
  updateNavShadow();
}

function render(opts) {
  rendering = rendering.then(() => doRender(opts)).catch((e) => {
    console.error(e);
    alertDialog('Greška', e?.message || String(e));
  });
  return rendering;
}

const scroller = () => viewRoot.querySelector('.scroller');

function updateNavShadow() {
  const nav = viewRoot.querySelector('.nav');
  if (nav) nav.classList.toggle('scrolled', (scroller()?.scrollTop || 0) > 24);
}

/** Visina okvira = vidljiva visina prozora (pouzdanije od 100vh u aplikaciji sa početnog ekrana). */
function updateAppHeight() {
  const h = window.innerHeight;
  if (h > 0) document.documentElement.style.setProperty('--app-h', `${h}px`);
}
updateAppHeight();
window.addEventListener('resize', updateAppHeight);
window.addEventListener('orientationchange', () => setTimeout(updateAppHeight, 300));
window.addEventListener('pageshow', updateAppHeight);

function showDbError(e) {
  const detail = [e?.name, e?.message].filter(Boolean).join(': ') || String(e);
  viewRoot.innerHTML = `<div class="page" style="padding-top:calc(env(safe-area-inset-top) + 24px)">
    <div class="empty" style="padding-bottom:12px">${icon('database')}<h3>Baza podataka nije dostupna</h3>
      <p class="small faint">${esc(detail)}</p></div>
    <div class="group"><div class="row align-top"><div class="row-main">
      <div class="strong">Pokušajte redom:</div>
      <ol style="margin:8px 0 0;padding-left:20px;line-height:1.5">
        <li>Zatvorite sve druge kartice u Safariju sa ovom adresom i aplikaciju sa početnog ekrana (prevucite je nagore u pregledu aplikacija), pa dodirnite „Pokušaj ponovo”.</li>
        <li>Ako je uključen privatni režim Safarija, otvorite adresu u običnom režimu.</li>
        <li>Ako i dalje ne radi: iOS Podešavanja › Safari › Napredno › Podaci veb-sajtova › obrišite ovu adresu. Pažnja: briše i podatke unete na ovoj adresi.</li>
      </ol></div></div></div>
    <button type="button" class="btn btn-primary btn-block mt-lg" data-retry>Pokušaj ponovo</button>
  </div>`;
  viewRoot.querySelector('[data-retry]').addEventListener('click', () => location.reload());
}

async function start() {
  onDBBlocked(() => {
    viewRoot.innerHTML = `<div class="empty" style="padding-top:calc(env(safe-area-inset-top) + 40px)">${icon('database')}
      <h3>Ažuriram bazu podataka…</h3>
      <p>Na ovom uređaju je otvorena i starija verzija aplikacije. Zatvorite druge kartice sa ovom adresom i aplikaciju sa početnog ekrana – nastavak je automatski.</p>
      <p class="mt"><span class="spinner" style="display:inline-block"></span></p></div>`;
  });
  try {
    await loadAll();
  } catch (e) {
    console.error(e);
    showDbError(e);
    return;
  }
  // Ovo nije presudno za rad – greška ovde ne sme da blokira aplikaciju.
  try { await cleanupEmptyDrafts(); } catch (e) { console.warn('Nacrti:', e); }
  try { await seedIfNeeded(); } catch (e) { console.warn('Primer podataka:', e); }
  initFileInputs();
  setRenderer(render);

  window.addEventListener('hashchange', () => render({ isBack: track(location.hash || '#/') }));
  // Događaj skrolovanja ne "mehuri", pa ga hvatamo u fazi hvatanja.
  document.addEventListener('scroll', updateNavShadow, { passive: true, capture: true });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nav-back]');
    if (b) { e.preventDefault(); back(b.dataset.navBack); }
  });
  // Pre gašenja / prelaska u pozadinu sačuvaj otvoren izveštaj.
  const flush = () => current?.flush?.();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  track(location.hash || '#/');
  await render();
}

if ('serviceWorker' in navigator) {
  if (new URLSearchParams(location.search).has('dev')) {
    // Probni režim: bez keša, da se izmene odmah vide.
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    caches?.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  } else {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW:', e)));
  }
}

start();

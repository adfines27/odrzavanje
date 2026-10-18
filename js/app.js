// Pokretanje aplikacije: učitavanje baze, primer podataka, ruter, tab bar, service worker.

import { loadAll, cleanupEmptyDrafts } from './store.js';
import { seedIfNeeded } from './seed.js';
import { setRenderer, track, back } from './router.js';
import { icon } from './icons.js';
import { hydratePhotos, initFileInputs, alertDialog } from './ui.js';
import { esc } from './util.js';
import { homeView, dueTasksView } from './views/home.js';
import { equipmentListView, equipmentDetailView, equipmentFormView, taskFormView } from './views/equipment.js';
import { reportListView, reportDetailView } from './views/reports.js';
import { reportFormView } from './views/reportForm.js';
import { settingsView } from './views/settings.js';

const routes = [
  [/^\/$/, () => homeView()],
  [/^\/zadaci\/(kasni|uskoro)$/, (m) => dueTasksView(m[1] === 'kasni' ? 'overdue' : 'soon')],
  [/^\/oprema$/, () => equipmentListView()],
  [/^\/oprema\/nova$/, () => equipmentFormView(null)],
  [/^\/oprema\/([\w-]+)$/, (m) => equipmentDetailView(m[1])],
  [/^\/oprema\/([\w-]+)\/izmena$/, (m) => equipmentFormView(m[1])],
  [/^\/oprema\/([\w-]+)\/zadatak$/, (m) => taskFormView(m[1], null)],
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

  if (currentHash) scrollPositions.set(currentHash, window.scrollY);
  const prevScroll = window.scrollY;
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
  viewRoot.replaceChildren(view.el);
  document.body.classList.toggle('no-tabbar', !!view.fullScreen);
  document.body.classList.toggle('has-actionbar', !!view.el.querySelector('.actionbar'));
  renderTabbar(view.tab);
  hydratePhotos(view.el);
  view.mounted?.();

  const y = keepScroll ? prevScroll : isBack ? scrollPositions.get(hash) || 0 : 0;
  window.scrollTo(0, y);
  updateNavShadow();
}

function render(opts) {
  rendering = rendering.then(() => doRender(opts)).catch((e) => {
    console.error(e);
    alertDialog('Greška', e?.message || String(e));
  });
  return rendering;
}

function updateNavShadow() {
  const nav = viewRoot.querySelector('.nav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 24);
}

async function start() {
  try {
    await loadAll();
    await cleanupEmptyDrafts();
    await seedIfNeeded();
  } catch (e) {
    console.error(e);
    viewRoot.innerHTML = `<div class="empty"><h3>Baza podataka nije dostupna</h3><p>${esc(e?.message || e)}</p>
      <p class="mt">Ako koristite privatni režim pregledača, otvorite aplikaciju u običnom režimu.</p></div>`;
    return;
  }
  initFileInputs();
  setRenderer(render);

  window.addEventListener('hashchange', () => render({ isBack: track(location.hash || '#/') }));
  window.addEventListener('scroll', updateNavShadow, { passive: true });
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

if ('serviceWorker' in navigator && !new URLSearchParams(location.search).has('dev')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW:', e)));
}

start();

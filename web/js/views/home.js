// Početna: brojači "Kasni", "Uskoro (7 dana)", "Otvoreni izveštaji" i najhitniji zadaci.

import { S, plannedTasks, dueState, daysUntil, nextDue, isOpenReport, DUE } from '../store.js';
import { el } from '../router.js';
import { navBar, largeTitle, dueBadge, emptyState } from '../ui.js';
import { icon } from '../icons.js';
import { esc, fmtDate, dueText, prefs } from '../util.js';

export function taskCard(t, now) {
  const eq = S.equipment.get(t.equipmentId);
  const state = dueState(t, now);
  return `<a class="card" href="#/oprema/${eq.id}">
    <span class="text-${state}">${icon(DUE[state].icon, 'state-icon')}</span>
    <div class="row-main stack-sm">
      <div class="card-title">${esc(eq.tag)} · ${esc(eq.name)}</div>
      <div>${esc(t.name)}</div>
      <div class="muted small">Rok: ${fmtDate(nextDue(t))}</div>
      <div>${dueBadge(state, dueText(daysUntil(t, now)))}</div>
    </div>
    <span class="chev">${icon('chevronRight')}</span>
  </a>`;
}

function installHint() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone || prefs.get('installHintHidden', false)) return '';
  return `<div class="banner info" id="install-hint">
    ${icon('phone')}
    <div class="row-main">
      <div class="strong">Dodajte aplikaciju na početni ekran</div>
      <div class="small muted">U Safariju dodirnite ${icon('share')} Deli → „Dodaj na početni ekran”. Tada radi preko celog ekrana i bez interneta, a podaci su sigurniji.</div>
    </div>
    <button type="button" class="nav-btn" data-hide-hint aria-label="Sakrij">${icon('x')}</button>
  </div>`;
}

export function homeView() {
  const now = new Date();
  const planned = plannedTasks();
  const overdue = planned.filter((t) => dueState(t, now) === 'overdue');
  const soon = planned.filter((t) => dueState(t, now) === 'soon');
  const reports = [...S.reports.values()];
  const openCount = reports.filter(isOpenReport).length;
  const drafts = reports.filter((r) => r.isDraft).length;

  const counter = (href, label, value, iconName, tone) =>
    `<a class="counter" href="${href}" style="--tone: var(--${tone})" aria-label="${esc(label)}: ${value}">
      ${icon(iconName)}<span class="num">${value}</span><span class="lbl">${esc(label)}</span></a>`;

  let urgent;
  if (!planned.length) {
    urgent = emptyState('calendar', 'Nema plana održavanja', 'Otvorite opremu i dodajte zadatke u plan održavanja.');
  } else if (!overdue.length && !soon.length) {
    urgent = `<p class="strong text-ok inline-flex mt">${icon('ok')} Nema zadataka koji kasne ili ističu u narednih 7 dana.</p>
      <h2 class="section-title big">Sledeći zadaci</h2>${planned.slice(0, 5).map((t) => taskCard(t, now)).join('')}`;
  } else {
    urgent = `<h2 class="section-title big">Najhitniji zadaci</h2>${[...overdue, ...soon].map((t) => taskCard(t, now)).join('')}`;
  }

  const root = el(`
    ${navBar({ title: 'Početna' })}
    ${largeTitle('Početna', fmtDate(now))}
    <div class="page">
      <div class="counters">
        ${counter('#/zadaci/kasni', 'Kasni', overdue.length, 'overdue', overdue.length ? 'overdue' : 'ok')}
        ${counter('#/zadaci/uskoro', 'Uskoro (7 dana)', soon.length, 'soon', soon.length ? 'soon' : 'ok')}
        ${counter('#/izvestaji?status=open', 'Otvoreni izveštaji', openCount, 'doc', 'accent')}
      </div>
      ${drafts ? `<a class="banner" href="#/izvestaji?status=drafts">${icon('draft')}
        <div class="row-main"><div class="strong">Nedovršeni izveštaji: ${drafts}</div>
        <div class="small muted">Sačuvani su kao nacrt. Dodirnite da nastavite.</div></div>
        <span class="chev">${icon('chevronRight')}</span></a>` : ''}
      ${installHint()}
      ${urgent}
    </div>`);

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-hide-hint]')) {
      prefs.set('installHintHidden', true);
      root.querySelector('#install-hint')?.remove();
    }
  });
  return { el: root, tab: 'home' };
}

export function dueTasksView(state) {
  const now = new Date();
  const list = plannedTasks().filter((t) => dueState(t, now) === state);
  const title = state === 'overdue' ? 'Kasni' : 'Uskoro (7 dana)';
  const root = el(`
    ${navBar({ title, back: { label: 'Početna', fallback: '#/' } })}
    ${largeTitle(title)}
    <div class="page">
      ${list.length ? list.map((t) => taskCard(t, now)).join('')
        : emptyState('ok', state === 'overdue' ? 'Nijedan zadatak ne kasni' : 'Nema zadataka u narednih 7 dana')}
    </div>`);
  return { el: root, tab: 'home' };
}

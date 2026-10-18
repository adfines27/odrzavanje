// Izveštaji: lista sa filterima (period, status, oprema) i detalji izveštaja.

import {
  S, reportsSorted, photosOf, reportType, isOpenReport, equipmentSorted, deleteReport, newDraftReport, nextDue,
} from '../store.js';
import { el, go, back } from '../router.js';
import {
  navBar, largeTitle, actionBar, reportBadge, badge, emptyState, confirmDialog, toast, thumbImg, busy, offerFile, alertDialog,
} from '../ui.js';
import { icon } from '../icons.js';
import { esc, fmtDateTime, fmtDate, fmtStamp, durationText, matches, photosWord, isoDate, parseDate } from '../util.js';
import { reportToPDF } from '../pdf.js';
import { openViewer } from './viewer.js';

export function reportRow(r, { showEquipment = true } = {}) {
  const eq = S.equipment.get(r.equipmentId);
  const t = reportType(r.type);
  const n = photosOf(r.id).length;
  return `<a class="row align-top" href="#/izvestaj/${r.id}">
    <span style="color:var(--accent);margin-top:2px">${icon(t.icon, 'icon-lg')}</span>
    <div class="row-main stack-sm">
      ${showEquipment ? `<div class="row-title">${eq ? `${esc(eq.tag)} · ${esc(eq.name)}` : '<span class="muted">Oprema nije izabrana</span>'}</div>` : ''}
      <div class="${showEquipment ? 'row-sub' : 'row-title'}">${esc(t.title)} · ${fmtDateTime(r.date)}</div>
      ${r.problem ? `<div class="row-sub" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(r.problem)}</div>` : ''}
      <div class="inline-flex">${reportBadge(r)}${n ? `<span class="muted small inline-flex" aria-label="${photosWord(n)}">${icon('image')}${n}</span>` : ''}</div>
    </div>
    <span class="chev">${icon('chevronRight')}</span>
  </a>`;
}

// ---------- Lista ----------

const STATUS_FILTERS = [
  { id: 'all', title: 'Svi statusi', test: () => true },
  { id: 'open', title: 'Otvoreni (otvoren + u toku)', test: isOpenReport },
  { id: 'onlyOpen', title: 'Otvoren', test: (r) => !r.isDraft && r.status === 'open' },
  { id: 'inProgress', title: 'U toku', test: (r) => !r.isDraft && r.status === 'inProgress' },
  { id: 'completed', title: 'Završen', test: (r) => !r.isDraft && r.status === 'completed' },
  { id: 'drafts', title: 'Nacrti', test: (r) => r.isDraft },
];

const filter = { q: '', status: 'all', equipmentId: '', from: '', to: '' };

export function reportListView(query) {
  if (query.has('status')) {
    filter.status = STATUS_FILTERS.some((s) => s.id === query.get('status')) ? query.get('status') : 'all';
    filter.equipmentId = '';
    filter.from = '';
    filter.to = '';
  }
  const all = reportsSorted();
  const equipment = equipmentSorted();
  const active = () => (filter.status !== 'all') + !!filter.equipmentId + !!(filter.from || filter.to);

  const root = el(`
    ${navBar({ title: 'Izveštaji' })}
    ${largeTitle('Izveštaji')}
    <div class="page">
      <label class="search">${icon('search')}<input type="search" id="r-q" placeholder="Pretraži izveštaje" value="${esc(filter.q)}" enterkeyhint="search" autocomplete="off" aria-label="Pretraga izveštaja"></label>
      <div class="filters">
        <div class="select-pill" data-pill="status"><select id="r-status" aria-label="Status">
          ${STATUS_FILTERS.map((s) => `<option value="${s.id}" ${filter.status === s.id ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}
        </select></div>
        <div class="select-pill" data-pill="eq"><select id="r-eq" aria-label="Oprema">
          <option value="">Sva oprema</option>
          ${equipment.map((e) => `<option value="${e.id}" ${filter.equipmentId === e.id ? 'selected' : ''}>${esc(e.tag)} · ${esc(e.name)}</option>`).join('')}
        </select></div>
      </div>
      <div class="group mt">
        <label class="field inline"><span class="label">Od datuma</span><input type="date" id="r-from" value="${esc(filter.from)}"></label>
        <label class="field inline"><span class="label">Do datuma</span><input type="date" id="r-to" value="${esc(filter.to)}"></label>
      </div>
      <div id="r-active"></div>
      <div id="r-list" class="mt"></div>
    </div>
    ${actionBar(`<button type="button" class="btn btn-primary btn-block" data-new>${icon('plus')}Novi izveštaj</button>`)}`);

  const listEl = root.querySelector('#r-list');
  const activeEl = root.querySelector('#r-active');

  const renderList = () => {
    const st = STATUS_FILTERS.find((s) => s.id === filter.status) || STATUS_FILTERS[0];
    const list = all.filter((r) => {
      if (!st.test(r)) return false;
      if (filter.equipmentId && r.equipmentId !== filter.equipmentId) return false;
      const day = r.date.slice(0, 10);
      if (filter.from && day < filter.from) return false;
      if (filter.to && day > filter.to) return false;
      const eq = S.equipment.get(r.equipmentId);
      return matches([eq?.tag || '', eq?.name || '', r.problem, r.findings, r.actions, r.parts, r.technician], filter.q);
    });
    root.querySelector('[data-pill="status"]').classList.toggle('active', filter.status !== 'all');
    root.querySelector('[data-pill="eq"]').classList.toggle('active', !!filter.equipmentId);
    const n = active();
    activeEl.innerHTML = n ? `<div class="row group mt" style="border:0"><div class="row-main strong">Aktivni filteri: ${n}</div>
      <button type="button" class="btn btn-small" data-reset>Poništi</button></div>` : '';
    if (!all.length) listEl.innerHTML = emptyState('doc', 'Nema izveštaja', 'Novi izveštaj napravite dugmetom ispod ili sa ekrana opreme.');
    else if (!list.length) listEl.innerHTML = emptyState('filter', 'Nema rezultata', 'Promenite ili poništite filtere.');
    else listEl.innerHTML = `<div class="group">${list.map((r) => reportRow(r)).join('')}</div><p class="section-footer">Prikazano: ${list.length} od ${all.length}</p>`;
  };
  renderList();

  root.querySelector('#r-q').addEventListener('input', (e) => { filter.q = e.target.value; renderList(); });
  root.querySelector('#r-status').addEventListener('change', (e) => { filter.status = e.target.value; renderList(); });
  root.querySelector('#r-eq').addEventListener('change', (e) => { filter.equipmentId = e.target.value; renderList(); });
  root.querySelector('#r-from').addEventListener('change', (e) => { filter.from = e.target.value; renderList(); });
  root.querySelector('#r-to').addEventListener('change', (e) => { filter.to = e.target.value; renderList(); });
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-reset]')) {
      Object.assign(filter, { status: 'all', equipmentId: '', from: '', to: '' });
      root.querySelector('#r-status').value = 'all';
      root.querySelector('#r-eq').value = '';
      root.querySelector('#r-from').value = '';
      root.querySelector('#r-to').value = '';
      renderList();
    } else if (e.target.closest('[data-new]')) {
      const r = await newDraftReport(filter.equipmentId || null);
      go(`#/izvestaj/${r.id}/uredi?novi=1`);
    }
  });
  return { el: root, tab: 'reports' };
}

// ---------- Detalji ----------

export function reportDetailView(id) {
  const r = S.reports.get(id);
  if (!r) return { redirect: '#/izvestaji' };
  const eq = S.equipment.get(r.equipmentId);
  const t = reportType(r.type);
  const task = r.type === 'preventive' && r.taskId ? S.tasks.get(r.taskId) : null;
  const photos = photosOf(id);
  const kv = (k, v) => `<div class="row"><div class="row-main muted">${esc(k)}</div><div class="row-value">${esc(v || '—')}</div></div>`;
  const text = (title, body) => `<h2 class="section-title">${esc(title)}</h2>
    <div class="group"><div class="row align-top"><div class="row-main ${body?.trim() ? '' : 'muted'}" style="white-space:pre-wrap;user-select:text;-webkit-user-select:text">${esc(body?.trim() ? body : '—')}</div></div></div>`;

  const root = el(`
    ${navBar({ title: 'Izveštaj', alwaysTitle: true, back: { label: 'Nazad', fallback: '#/izvestaji' } })}
    <div class="page">
      ${r.isDraft ? `<div class="banner info">${icon('draft')}<div class="row-main strong">Ovo je nacrt. Dovršite ga i sačuvajte dugmetom Izmeni.</div></div>` : ''}
      <div class="group mt">
        ${eq ? `<a class="row" href="#/oprema/${eq.id}"><div class="row-main stack-sm">
            <div class="row-title" style="font-size:1.25rem">${esc(eq.tag)}</div><div>${esc(eq.name)}</div>
            ${eq.area ? `<div class="row-meta">${esc(eq.area)}</div>` : ''}</div><span class="chev">${icon('chevronRight')}</span></a>`
          : '<div class="row muted">Oprema nije izabrana</div>'}
        <div class="row"><div class="inline-flex">${reportBadge(r)}${badge(t.title, t.icon, 'accent')}</div></div>
        ${kv('Datum i vreme', fmtDateTime(r.date))}
        ${kv('Tehničar', r.technician)}
        ${kv('Trajanje', durationText(r.durationMinutes))}
        ${task ? kv('Zadatak iz plana', task.name) + kv('Sledeći rok zadatka', fmtDate(nextDue(task))) : ''}
      </div>
      ${text('Opis problema / rada', r.problem)}
      ${text('Nalaz', r.findings)}
      ${text('Preduzete mere', r.actions)}
      ${text('Utrošeni delovi', r.parts)}
      <h2 class="section-title">Fotografije (${photos.length})</h2>
      <div class="group">
        ${photos.length ? `<div class="photo-grid two">${photos.map((p, i) => `<div>
            <button type="button" class="thumb" data-photo-index="${i}" aria-label="Fotografija ${i + 1}">${thumbImg(p.id)}<span class="photo-label lbl-${p.label}">${esc({ before: 'PRE', after: 'POSLE', other: 'OSTALO' }[p.label])}</span></button>
            ${p.caption ? `<div class="photo-caption">${esc(p.caption)}</div>` : ''}</div>`).join('')}</div>`
          : '<div class="row muted">Nema fotografija.</div>'}
      </div>
      <p class="section-footer">Kreiran: ${fmtStamp(r.createdAt)} · Izmenjen: ${fmtStamp(r.updatedAt)}</p>
    </div>
    ${actionBar(`
      <a class="btn btn-stack btn-grow" href="#/izvestaj/${id}/uredi">${icon('pencil')}Izmeni</a>
      <button type="button" class="btn btn-stack btn-grow" data-pdf>${icon('share')}Podeli kao PDF</button>
      <button type="button" class="btn btn-stack btn-grow btn-danger" data-delete>${icon('trash')}Obriši</button>`)}`);

  root.addEventListener('click', async (e) => {
    const ph = e.target.closest('[data-photo-index]');
    if (ph) {
      openViewer({ reportId: id, index: +ph.dataset.photoIndex, editable: false });
    } else if (e.target.closest('[data-pdf]')) {
      try {
        const { blob, fileName } = await busy('Pravim PDF…', () => reportToPDF(r));
        await offerFile(blob, fileName, 'PDF je spreman');
      } catch (err) {
        console.error(err);
        alertDialog('PDF nije napravljen', err?.message || String(err));
      }
    } else if (e.target.closest('[data-delete]')) {
      const ok = await confirmDialog({
        title: 'Obrisati izveštaj?',
        message: `Izveštaj i ${photosWord(photos.length)} biće trajno obrisani sa uređaja. Ovo se ne može poništiti.`,
        confirm: 'Obriši izveštaj',
      });
      if (!ok) return;
      await deleteReport(id);
      toast('Izveštaj je obrisan.');
      back('#/izvestaji');
    }
  });
  return { el: root, tab: 'reports' };
}

export { isoDate, parseDate };

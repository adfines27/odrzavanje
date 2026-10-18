// Oprema: lista sa pretragom i filterima, detalji, forma opreme i forma zadatka iz plana.

import {
  S, EQUIPMENT_TYPES, equipmentType, equipmentSorted, tasksOf, reportsOf, nextDue, dueState, daysUntil, worstState,
  DUE, newEquipment, saveEquipment, deleteEquipment, tagExists, newTask, saveTask, deleteTask, addPhoto, deletePhoto,
  newDraftReport,
} from '../store.js';
import { el, go, back, rerender } from '../router.js';
import {
  navBar, largeTitle, actionBar, dueBadge, emptyState, confirmDialog, toast, thumbImg, hydratePhotos,
} from '../ui.js';
import { icon } from '../icons.js';
import {
  esc, fmtDate, fmtPower, fmtNumber, parseDecimal, matches, daysWord, dueText, parseDate, isoDate, addDays, startOfDay, reportsWord,
} from '../util.js';
import { photoButtons, bindPhotoInputs, cameraHelp } from './photoInput.js';
import { reportRow } from './reports.js';
import { openSinglePhoto } from './viewer.js';

// ---------- Lista ----------

const listState = { q: '', type: '', area: '' };

function equipmentRow(e) {
  const state = worstState(e.id);
  const t = equipmentType(e.type);
  return `<a class="row" href="#/oprema/${e.id}">
    <span class="lead-icon">${e.mainPhotoId ? thumbImg(e.mainPhotoId) : icon(t.icon)}</span>
    <div class="row-main">
      <div class="row-title">${esc(e.tag)}</div>
      <div class="row-sub">${esc(e.name)}</div>
      <div class="row-meta">${esc([t.title, e.area].filter(Boolean).join(' · '))}</div>
      ${state && state !== 'ok' ? `<div class="mt" style="margin-top:4px">${dueBadge(state)}</div>` : ''}
    </div>
    <span class="chev">${icon('chevronRight')}</span>
  </a>`;
}

export function equipmentListView() {
  const all = equipmentSorted();
  const areas = [...new Set(all.map((e) => e.area.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sr'));
  if (listState.area && !areas.includes(listState.area)) listState.area = '';

  const root = el(`
    ${navBar({ title: 'Oprema' })}
    ${largeTitle('Oprema')}
    <div class="page">
      <label class="search">${icon('search')}<input type="search" id="eq-q" placeholder="Oznaka, naziv, lokacija…" value="${esc(listState.q)}" enterkeyhint="search" autocomplete="off" aria-label="Pretraga opreme"></label>
      <div class="filters">
        <div class="select-pill ${listState.type ? 'active' : ''}"><select id="eq-type" aria-label="Filter po tipu">
          <option value="">Svi tipovi</option>
          ${EQUIPMENT_TYPES.map((t) => `<option value="${t.id}" ${listState.type === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
        </select></div>
        <div class="select-pill ${listState.area ? 'active' : ''}"><select id="eq-area" aria-label="Filter po lokaciji">
          <option value="">Sve lokacije</option>
          ${areas.map((a) => `<option value="${esc(a)}" ${listState.area === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
        </select></div>
      </div>
      <div id="eq-list" class="mt"></div>
    </div>
    ${actionBar(`<a class="btn btn-primary btn-block" href="#/oprema/nova">${icon('plus')}Dodaj opremu</a>`)}`);

  const listEl = root.querySelector('#eq-list');
  const renderList = () => {
    const filtered = all.filter((e) =>
      (!listState.type || e.type === listState.type) &&
      (!listState.area || e.area.trim() === listState.area) &&
      matches([e.tag, e.name, e.area, e.manufacturer, e.model, e.serialNumber], listState.q));
    if (!all.length) {
      listEl.innerHTML = emptyState('equipment', 'Nema opreme', 'Dodajte opremu dugmetom ispod ili je uvezite iz CSV fajla u Podešavanjima.');
    } else if (!filtered.length) {
      listEl.innerHTML = emptyState('search', 'Nema rezultata', 'Promenite pretragu ili filtere.');
    } else {
      listEl.innerHTML = `<div class="group">${filtered.map(equipmentRow).join('')}</div>
        <p class="section-footer">Prikazano: ${filtered.length} od ${all.length}</p>`;
      hydratePhotos(listEl);
    }
  };
  renderList();

  root.querySelector('#eq-q').addEventListener('input', (e) => { listState.q = e.target.value; renderList(); });
  root.querySelector('#eq-type').addEventListener('change', (e) => {
    listState.type = e.target.value;
    e.target.parentElement.classList.toggle('active', !!e.target.value);
    renderList();
  });
  root.querySelector('#eq-area').addEventListener('change', (e) => {
    listState.area = e.target.value;
    e.target.parentElement.classList.toggle('active', !!e.target.value);
    renderList();
  });
  return { el: root, tab: 'equipment' };
}

// ---------- Detalji ----------

function taskRow(t, now) {
  const state = dueState(t, now);
  return `<a class="row align-top" href="#/zadatak/${t.id}">
    <span class="text-${state}" style="margin-top:2px">${icon(DUE[state].icon, 'icon-lg')}</span>
    <div class="row-main stack-sm">
      <div class="row-title">${esc(t.name)}</div>
      <div class="row-sub">Interval: ${daysWord(t.intervalDays)}</div>
      <div class="row-sub">Poslednji put: ${fmtDate(t.lastDoneDate)}</div>
      <div class="strong">Sledeći rok: ${fmtDate(nextDue(t))}</div>
      <div>${dueBadge(state, dueText(daysUntil(t, now)))}</div>
    </div>
    <span class="chev">${icon('pencil')}</span>
  </a>`;
}

const kv = (k, v) => `<div class="row"><div class="row-main muted">${esc(k)}</div><div class="row-value">${esc(v || '—')}</div></div>`;

export function equipmentDetailView(id) {
  const e = S.equipment.get(id);
  if (!e) return { redirect: '#/oprema' };
  const now = new Date();
  const t = equipmentType(e.type);
  const tasks = tasksOf(id);
  const reports = reportsOf(id);
  const state = worstState(id, now);

  const root = el(`
    ${navBar({ title: e.tag, back: { label: 'Nazad', fallback: '#/oprema' },
      right: `<a class="nav-btn" href="#/oprema/${id}/izmena">Izmeni</a>` })}
    ${largeTitle(e.tag)}
    <div class="page">
      <div class="group"><div class="row align-top">
        ${e.mainPhotoId
          ? `<button type="button" class="thumb" style="width:96px;flex:none" data-main-photo aria-label="Prikaži fotografiju opreme">${thumbImg(e.mainPhotoId)}</button>`
          : `<span class="lead-icon" style="width:72px;height:72px">${icon(t.icon, 'icon-lg')}</span>`}
        <div class="row-main stack-sm">
          <div class="row-title" style="font-size:1.1rem">${esc(e.name)}</div>
          ${e.area ? `<div class="row-sub inline-flex">${icon('pin')}${esc(e.area)}</div>` : ''}
          ${state ? `<div>${dueBadge(state)}</div>` : ''}
        </div>
      </div></div>

      <h2 class="section-title">Podaci</h2>
      <div class="group">
        ${kv('Tip', t.title)}${kv('Lokacija', e.area)}${kv('Proizvođač', e.manufacturer)}
        ${kv('Model', e.model)}${kv('Serijski broj', e.serialNumber)}${kv('Nominalna snaga', fmtPower(e.ratedPowerKW))}
        ${e.notes ? `<div class="row align-top"><div class="row-main"><div class="muted small strong">Napomena</div><div style="white-space:pre-wrap">${esc(e.notes)}</div></div></div>` : ''}
      </div>

      <h2 class="section-title">Plan održavanja</h2>
      <div class="group">
        ${tasks.length ? tasks.map((x) => taskRow(x, now)).join('') : '<div class="row muted">Još nema zadataka u planu.</div>'}
        <a class="row strong" href="#/oprema/${id}/zadatak" style="color:var(--accent)">${icon('plus')}Dodaj zadatak u plan</a>
      </div>

      <h2 class="section-title">Istorija izveštaja (${reports.length})</h2>
      <div class="group">
        ${reports.length ? reports.map((r) => reportRow(r, { showEquipment: false })).join('') : '<div class="row muted">Još nema izveštaja.</div>'}
      </div>
    </div>
    ${actionBar(`<button type="button" class="btn btn-primary btn-block" data-new-report>${icon('plus')}Novi izveštaj</button>`)}`);

  root.addEventListener('click', async (ev) => {
    if (ev.target.closest('[data-new-report]')) {
      const r = await newDraftReport(id);
      go(`#/izvestaj/${r.id}/uredi?novi=1`);
    } else if (ev.target.closest('[data-main-photo]')) {
      openSinglePhoto(e.mainPhotoId);
    }
  });
  return { el: root, tab: 'equipment' };
}

// ---------- Forma opreme ----------

function field(label, inner, { error = '', inline = false } = {}) {
  return `<label class="field ${inline ? 'inline' : ''} ${error ? 'invalid' : ''}"><span class="label">${esc(label)}</span>${inner}${
    error ? `<span class="field-error">${icon('overdue')}${esc(error)}</span>` : ''}</label>`;
}

export function equipmentFormView(id) {
  const existing = id ? S.equipment.get(id) : null;
  if (id && !existing) return { redirect: '#/oprema' };
  const draft = existing ? { ...existing } : newEquipment();
  let powerText = existing ? fmtNumber(existing.ratedPowerKW) : '';
  const addedPhotos = [];
  let saved = false;
  let attempted = false;
  let unbind = null;

  const errors = () => {
    const tag = draft.tag.trim();
    const power = parseDecimal(powerText);
    return {
      tag: !tag ? 'Oznaka je obavezna.' : tagExists(tag, draft.id) ? `Oprema sa oznakom ${tag.toUpperCase()} već postoji.` : '',
      name: !draft.name.trim() ? 'Naziv je obavezan.' : '',
      power: Number.isNaN(power) ? 'Unesite broj, npr. 15,5' : '',
    };
  };

  const root = el('');
  const render = () => {
    const err = attempted ? errors() : { tag: '', name: '', power: Number.isNaN(parseDecimal(powerText)) ? 'Unesite broj, npr. 15,5' : '' };
    root.innerHTML = `
      ${navBar({ title: existing ? 'Izmena opreme' : 'Nova oprema', alwaysTitle: true,
        left: '<button type="button" class="nav-btn" data-cancel>Otkaži</button>',
        right: '<button type="button" class="nav-btn strong" data-save>Sačuvaj</button>' })}
      <div class="page">
        <h2 class="section-title">Osnovno</h2>
        <div class="group">
          ${field('Oznaka (tag)', `<input name="tag" value="${esc(draft.tag)}" placeholder="npr. M-101" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="next">`, { error: err.tag })}
          ${field('Naziv', `<input name="name" value="${esc(draft.name)}" placeholder="npr. Elektromotor glavne pumpe" enterkeyhint="next">`, { error: err.name })}
          ${field('Tip', `<select name="type">${EQUIPMENT_TYPES.map((t) => `<option value="${t.id}" ${draft.type === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select>`)}
          ${field('Lokacija / oblast', `<input name="area" value="${esc(draft.area)}" placeholder="npr. Pumpna stanica 1" list="areas" enterkeyhint="next">
            <datalist id="areas">${[...new Set(equipmentSorted().map((x) => x.area).filter(Boolean))].map((a) => `<option value="${esc(a)}">`).join('')}</datalist>`)}
        </div>
        <h2 class="section-title">Tehnički podaci</h2>
        <div class="group">
          ${field('Proizvođač', `<input name="manufacturer" value="${esc(draft.manufacturer)}" enterkeyhint="next">`)}
          ${field('Model', `<input name="model" value="${esc(draft.model)}" spellcheck="false" enterkeyhint="next">`)}
          ${field('Serijski broj', `<input name="serialNumber" value="${esc(draft.serialNumber)}" autocapitalize="characters" spellcheck="false" enterkeyhint="next">`)}
          ${field('Nominalna snaga (kW)', `<input name="power" value="${esc(powerText)}" inputmode="decimal" placeholder="npr. 15,5" enterkeyhint="next">`, { error: err.power })}
        </div>
        <h2 class="section-title">Napomena</h2>
        <div class="group">
          ${field('Napomena', `<textarea name="notes" rows="3" placeholder="Npr. tip ležajeva, posebna uputstva">${esc(draft.notes)}</textarea>`)}
        </div>
        <h2 class="section-title">Glavna fotografija</h2>
        <div class="group">
          ${draft.mainPhotoId ? `<div class="row">
              <button type="button" class="thumb" style="width:96px;flex:none" data-view-photo aria-label="Prikaži fotografiju">${thumbImg(draft.mainPhotoId)}</button>
              <div class="row-main"></div>
              <button type="button" class="btn btn-small btn-danger" data-remove-photo>${icon('trash')}Ukloni</button>
            </div>` : ''}
          ${photoButtons(1)}
          <p class="section-footer" style="padding:0 12px 12px;margin:0">${esc(cameraHelp)}</p>
        </div>
        ${existing ? `<div class="group mt-lg"><button type="button" class="row btn-danger strong" data-delete style="justify-content:center">${icon('trash')}Obriši opremu</button></div>
          <p class="section-footer">Brišu se i plan održavanja, svi izveštaji i fotografije ove opreme.</p>` : ''}
      </div>
      ${actionBar(`<button type="button" class="btn btn-primary btn-block" data-save>${icon('check')}Sačuvaj</button>`)}`;
    hydratePhotos(root);
    root.querySelectorAll('textarea').forEach((ta) => { ta.style.height = 'auto'; ta.style.height = `${Math.max(ta.scrollHeight, 80)}px`; });
  };
  render();

  root.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.name === 'power') powerText = t.value;
    else if (t.name && t.name in draft) draft[t.name] = t.value;
    if (t.tagName === 'TEXTAREA') { t.style.height = 'auto'; t.style.height = `${Math.max(t.scrollHeight, 80)}px`; }
  });

  const discardAdded = async () => {
    for (const pid of addedPhotos) if (pid !== (saved ? draft.mainPhotoId : null)) await deletePhoto(pid);
    addedPhotos.length = 0;
  };

  root.addEventListener('click', async (ev) => {
    if (ev.target.closest('[data-cancel]')) {
      await discardAdded();
      saved = true;
      back(existing ? `#/oprema/${id}` : '#/oprema');
    } else if (ev.target.closest('[data-save]')) {
      attempted = true;
      const err = errors();
      if (err.tag || err.name || err.power) {
        render();
        root.querySelector('.field.invalid input')?.focus();
        return;
      }
      const old = existing?.mainPhotoId || null;
      const power = parseDecimal(powerText);
      Object.assign(draft, {
        tag: draft.tag.trim().toUpperCase(), name: draft.name.trim(), area: draft.area.trim(),
        manufacturer: draft.manufacturer.trim(), model: draft.model.trim(), serialNumber: draft.serialNumber.trim(),
        notes: draft.notes.trim(), ratedPowerKW: power,
      });
      saved = true;
      await saveEquipment(draft);
      if (old && old !== draft.mainPhotoId) await deletePhoto(old);
      for (const pid of addedPhotos) if (pid !== draft.mainPhotoId) await deletePhoto(pid);
      addedPhotos.length = 0;
      toast('Oprema je sačuvana.');
      if (existing) back(`#/oprema/${draft.id}`);
      else go(`#/oprema/${draft.id}`, { replace: true });
    } else if (ev.target.closest('[data-remove-photo]')) {
      draft.mainPhotoId = null;
      render();
    } else if (ev.target.closest('[data-view-photo]')) {
      openSinglePhoto(draft.mainPhotoId);
    } else if (ev.target.closest('[data-delete]')) {
      const n = reportsOf(id).length;
      const ok = await confirmDialog({
        title: `Obrisati ${existing.tag}?`,
        message: `Biće obrisani i plan održavanja, ${reportsWord(n)} i sve fotografije. Ovo se ne može poništiti.`,
        confirm: 'Obriši opremu',
      });
      if (!ok) return;
      saved = true;
      await discardAdded();
      await deleteEquipment(id);
      toast('Oprema je obrisana.');
      go('#/oprema', { replace: true });
    }
  });

  return {
    el: root,
    tab: 'equipment',
    fullScreen: true,
    mounted() {
      unbind = bindPhotoInputs(root, () => 1, async (processed) => {
        const meta = await addPhoto(processed, { equipmentId: draft.id });
        addedPhotos.push(meta.id);
        draft.mainPhotoId = meta.id;
        render();
      });
    },
    async leave() {
      unbind?.();
      if (!saved) await discardAdded();
    },
  };
}

// ---------- Forma zadatka ----------

const QUICK_INTERVALS = [7, 30, 90, 180, 365];

export function taskFormView(equipmentId, taskId) {
  const existing = taskId ? S.tasks.get(taskId) : null;
  if (taskId && !existing) return { redirect: '#/oprema' };
  const eq = S.equipment.get(existing ? existing.equipmentId : equipmentId);
  if (!eq) return { redirect: '#/oprema' };
  const draft = existing ? { ...existing } : newTask(eq.id);
  let intervalText = String(draft.intervalDays);
  let attempted = false;
  const today = isoDate(new Date());

  const interval = () => {
    const v = parseInt(intervalText.replace(/\D/g, ''), 10);
    return v > 0 && v <= 3650 ? v : null;
  };
  const preview = () => {
    const iv = interval();
    return iv && draft.lastDoneDate ? fmtDate(addDays(startOfDay(parseDate(draft.lastDoneDate)), iv)) : '—';
  };

  const root = el(`
    ${navBar({ title: existing ? 'Izmena zadatka' : 'Novi zadatak', alwaysTitle: true,
      left: '<button type="button" class="nav-btn" data-cancel>Otkaži</button>',
      right: '<button type="button" class="nav-btn strong" data-save>Sačuvaj</button>' })}
    <div class="page">
      <div class="group mt">${kv('Oprema', `${eq.tag} · ${eq.name}`)}</div>
      <h2 class="section-title">Zadatak</h2>
      <div class="group">
        ${field('Naziv zadatka', `<input name="name" value="${esc(draft.name)}" placeholder="npr. Podmazivanje ležajeva" enterkeyhint="next">`)}
        <div data-name-error></div>
      </div>
      <h2 class="section-title">Interval</h2>
      <div class="group">
        <label class="field inline"><span class="label">Interval</span><input name="interval" value="${esc(intervalText)}" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done"><span class="unit">dana</span></label>
        <div style="padding:0 16px 10px"><div class="chips">${QUICK_INTERVALS.map((d) => `<button type="button" class="chip" data-interval="${d}">${daysWord(d)}</button>`).join('')}</div></div>
        <div data-interval-error></div>
      </div>
      <h2 class="section-title">Poslednje održavanje</h2>
      <div class="group">
        <label class="field inline"><span class="label">Poslednji put urađeno</span><input type="date" name="lastDoneDate" value="${esc(draft.lastDoneDate)}" max="${today}"></label>
        <div class="row"><div class="row-main">Sledeći rok</div><div class="strong" data-preview>${preview()}</div></div>
      </div>
      <p class="section-footer">Sledeći rok se računa automatski: poslednji put + interval. Kada preventivni izveštaj za ovaj zadatak dobije status Završen, datum poslednjeg održavanja se sam ažurira.</p>
      <h2 class="section-title">Napomena</h2>
      <div class="group">${field('Napomena', `<textarea name="notes" rows="2">${esc(draft.notes)}</textarea>`)}</div>
      ${existing ? `<div class="group mt-lg"><button type="button" class="row btn-danger strong" data-delete style="justify-content:center">${icon('trash')}Obriši zadatak</button></div>
        <p class="section-footer">Izveštaji ostaju sačuvani.</p>` : ''}
    </div>
    ${actionBar(`<button type="button" class="btn btn-primary btn-block" data-save>${icon('check')}Sačuvaj zadatak</button>`)}`);

  const showErrors = () => {
    const nameErr = attempted && !draft.name.trim() ? 'Naziv zadatka je obavezan.' : '';
    const ivErr = interval() ? '' : 'Unesite broj dana (1–3650).';
    root.querySelector('[data-name-error]').innerHTML = nameErr ? `<div class="field-error" style="padding:0 16px 10px">${icon('overdue')}${nameErr}</div>` : '';
    root.querySelector('[data-interval-error]').innerHTML = ivErr ? `<div class="field-error" style="padding:0 16px 10px">${icon('overdue')}${ivErr}</div>` : '';
    root.querySelector('[data-preview]').textContent = preview();
  };

  root.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.name === 'interval') intervalText = t.value;
    else if (t.name === 'lastDoneDate') draft.lastDoneDate = t.value || today;
    else if (t.name) draft[t.name] = t.value;
    showErrors();
  });

  root.addEventListener('click', async (ev) => {
    const chip = ev.target.closest('[data-interval]');
    if (chip) {
      intervalText = chip.dataset.interval;
      root.querySelector('[name="interval"]').value = intervalText;
      showErrors();
    } else if (ev.target.closest('[data-cancel]')) {
      back(`#/oprema/${eq.id}`);
    } else if (ev.target.closest('[data-save]')) {
      attempted = true;
      showErrors();
      if (!draft.name.trim() || !interval()) return;
      Object.assign(draft, { name: draft.name.trim(), notes: (draft.notes || '').trim(), intervalDays: interval() });
      await saveTask(draft);
      toast(`Sačuvano. Sledeći rok: ${fmtDate(nextDue(draft))}`);
      back(`#/oprema/${eq.id}`);
    } else if (ev.target.closest('[data-delete]')) {
      const ok = await confirmDialog({ title: 'Obrisati zadatak?', message: `„${existing.name}” će biti uklonjen iz plana. Izveštaji ostaju sačuvani.`, confirm: 'Obriši zadatak' });
      if (!ok) return;
      await deleteTask(existing.id);
      back(`#/oprema/${eq.id}`);
    }
  });

  return { el: root, tab: 'equipment', fullScreen: true };
}

export { rerender };

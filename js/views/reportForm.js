// Forma izveštaja. Izveštaj postoji u bazi od trenutka otvaranja (kao nacrt) i svaka izmena se
// automatski čuva – ako se aplikacija zatvori ili telefon zaključa, ništa se ne gubi.

import {
  S, REPORT_TYPES, REPORT_STATUSES, equipmentSorted, tasksOf, photosOf, saveReport, deleteReport, finalizeReport,
  isEmptyReport, completionPreview, addPhoto, applyCompletion, saveTask, nextDue,
} from '../store.js';
import { el, go, back } from '../router.js';
import { navBar, actionBar, choices, setChoice, dialog, toast, thumbImg, hydratePhotos } from '../ui.js';
import { icon } from '../icons.js';
import { esc, fmtDate, daysWord, debounce, nowISO, autoGrow, isoDateTime, parseDate } from '../util.js';
import { photoButtons, bindPhotoInputs, cameraHelp } from './photoInput.js';
import { openViewer } from './viewer.js';
import { catalogType } from '../catalog.js';

const MAX_PHOTOS = 10;
const LABEL_SHORT = { before: 'PRE', after: 'POSLE', other: 'OSTALO' };

export function reportFormView(id, isNew) {
  const r = S.reports.get(id);
  if (!r) return { redirect: '#/izvestaji' };
  let attempted = false;
  let closing = false;
  let unbind = null;

  const save = async () => {
    if (closing || !S.reports.has(r.id)) return;
    r.updatedAt = nowISO();
    await saveReport(r);
  };
  const autosave = debounce(save, 600);

  const field = (label, inner, extra = '') => `<label class="field" ${extra}><span class="label">${esc(label)}</span>${inner}</label>`;
  const textarea = (name, label, placeholder) =>
    field(label, `<textarea name="${name}" rows="3" placeholder="${esc(placeholder)}">${esc(r[name])}</textarea>`);

  const root = el(`
    ${navBar({ title: isNew && r.isDraft ? 'Novi izveštaj' : 'Izmena izveštaja', alwaysTitle: true,
      left: '<button type="button" class="nav-btn" data-close>Zatvori</button>' })}
    <div class="page">
      <h2 class="section-title">Osnovno</h2>
      <div class="group">
        ${field('Oprema', `<select name="equipmentId">
          <option value="">Izaberite opremu…</option>
          ${equipmentSorted().map((e) => `<option value="${e.id}" ${r.equipmentId === e.id ? 'selected' : ''}>${esc(e.tag)} · ${esc(e.name)}</option>`).join('')}
        </select>`, 'data-eq-field')}
        <div data-eq-error></div>
        ${field('Datum i vreme', `<input type="datetime-local" name="date" value="${esc(r.date)}">`)}
        <div class="field"><span class="label">Vrsta</span>${choices('type', REPORT_TYPES, r.type)}</div>
      </div>
      <div data-task-section></div>
      <h2 class="section-title">Status</h2>
      <div class="group"><div class="field">${choices('status', REPORT_STATUSES, r.status)}</div></div>
      <h2 class="section-title">Opis</h2>
      <div class="group">
        ${textarea('problem', 'Opis problema / rada', 'Šta je prijavljeno ili šta je planirano')}
        ${textarea('findings', 'Nalaz', 'Šta je utvrđeno na licu mesta')}
        ${textarea('actions', 'Preduzete mere', 'Šta je urađeno')}
        ${textarea('parts', 'Utrošeni delovi', 'Naziv, količina, šifra')}
        <div data-part-chips></div>
      </div>
      <h2 class="section-title">Trajanje i tehničar</h2>
      <div class="group">
        <label class="field inline"><span class="label">Trajanje</span>
          <input name="durationMinutes" value="${r.durationMinutes > 0 ? r.durationMinutes : ''}" inputmode="numeric" pattern="[0-9]*" placeholder="0" enterkeyhint="done"><span class="unit">min</span></label>
        <div style="padding:0 16px 10px"><div class="chips">
          ${[15, 30, 60].map((m) => `<button type="button" class="chip" data-add-min="${m}">+${m} min</button>`).join('')}
          <button type="button" class="chip" data-add-min="0" aria-label="Poništi trajanje">0</button>
        </div></div>
        ${field('Tehničar', `<input name="technician" value="${esc(r.technician)}" autocomplete="name" placeholder="Ime i prezime" enterkeyhint="done">`)}
      </div>
      <h2 class="section-title" data-photo-title></h2>
      <div class="group" data-photos></div>
      <p class="section-footer">Dodirnite fotografiju za uvećanje, oznaku Pre/Posle, opis ili brisanje. ${esc(cameraHelp)}</p>
    </div>
    ${actionBar(`<button type="button" class="btn btn-primary btn-block" data-finish>${icon('check')}Sačuvaj izveštaj</button>`,
      'Izmene se automatski čuvaju dok radite.')}`);

  // ---------- Delovi koji se menjaju ----------

  const renderEqError = () => {
    root.querySelector('[data-eq-error]').innerHTML = attempted && !r.equipmentId
      ? `<div class="field-error" style="padding:0 16px 10px">${icon('overdue')}Izaberite opremu.</div>` : '';
    root.querySelector('[data-eq-field]').classList.toggle('invalid', attempted && !r.equipmentId);
  };

  const renderTask = () => {
    const box = root.querySelector('[data-task-section]');
    if (r.type !== 'preventive') { box.innerHTML = ''; return; }
    const tasks = r.equipmentId ? tasksOf(r.equipmentId) : [];
    const task = r.taskId ? S.tasks.get(r.taskId) : null;
    const preview = completionPreview(r);
    box.innerHTML = `<h2 class="section-title">Plan održavanja</h2>
      <div class="group">
        ${field('Zadatak iz plana', `<select name="taskId" ${tasks.length ? '' : 'disabled'}>
          <option value="">${tasks.length ? 'Bez zadatka' : 'Oprema nema zadatke u planu'}</option>
          ${tasks.map((t) => `<option value="${t.id}" ${r.taskId === t.id ? 'selected' : ''}>${esc(t.name)} (${daysWord(t.intervalDays)})</option>`).join('')}
        </select>`)}
        ${task ? `<div class="row"><div class="row-main muted">Trenutni rok</div><div class="row-value">${fmtDate(nextDue(task))}</div></div>` : ''}
        ${preview ? `<div class="info-line text-ok">${icon('calendarCheck')}<span>Posle čuvanja: poslednji put ${fmtDate(preview.lastDone)}, sledeći rok ${fmtDate(preview.next)}</span></div>` : ''}
      </div>
      <p class="section-footer">Kada se preventivni izveštaj sačuva sa statusom Završen, zadatku se ažurira datum poslednjeg održavanja i računa novi rok.</p>`;
  };

  const renderPhotos = () => {
    const photos = photosOf(r.id);
    root.querySelector('[data-photo-title]').textContent = `Fotografije (${photos.length}/${MAX_PHOTOS})`;
    const box = root.querySelector('[data-photos]');
    box.innerHTML = `${photos.length ? `<div class="photo-grid">${photos.map((p, i) => `
        <button type="button" class="thumb" data-photo-index="${i}" aria-label="Fotografija ${i + 1}, ${LABEL_SHORT[p.label]}${p.caption ? `, ${esc(p.caption)}` : ''}">
          ${thumbImg(p.id)}<span class="photo-label lbl-${p.label}">${LABEL_SHORT[p.label]}</span>
          ${p.caption ? `<span class="cap-dot">${icon('bubble')}</span>` : ''}
        </button>`).join('')}</div>` : ''}
      ${photoButtons(MAX_PHOTOS - photos.length)}`;
    hydratePhotos(box);
  };

  const renderPartChips = () => {
    const eq = S.equipment.get(r.equipmentId);
    const parts = eq ? catalogType(eq.type).partNames : [];
    root.querySelector('[data-part-chips]').innerHTML = parts.length
      ? `<div style="padding:4px 16px 12px"><div class="small muted strong">Dodaj deo (dodir upisuje u listu):</div>
          <div class="chips wrap">${parts.map((p) => `<button type="button" class="chip" data-part="${esc(p)}">${icon('plus')}${esc(p)}</button>`).join('')}</div></div>`
      : '';
  };

  renderEqError();
  renderTask();
  renderPartChips();
  renderPhotos();

  // ---------- Unos ----------

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.name) return;
    if (t.name === 'durationMinutes') r.durationMinutes = Math.min(parseInt(t.value.replace(/\D/g, ''), 10) || 0, 100000);
    else if (t.name === 'date') { if (t.value) r.date = t.value; renderTask(); }
    else if (t.name in r && t.tagName !== 'SELECT') r[t.name] = t.value;
    if (t.tagName === 'TEXTAREA') autoGrow(t);
    autosave();
  });

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'equipmentId') {
      r.equipmentId = t.value || null;
      const task = r.taskId && S.tasks.get(r.taskId);
      if (task && task.equipmentId !== r.equipmentId) r.taskId = null;
      renderEqError();
      renderTask();
      renderPartChips();
      autosave();
    } else if (t.name === 'taskId') {
      r.taskId = t.value || null;
      renderTask();
      autosave();
    }
  });

  const finish = async () => {
    attempted = true;
    renderEqError();
    if (!r.equipmentId) {
      root.querySelector('[name="equipmentId"]').scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    autosave.flush();
    const task = await finalizeReport(r);
    closing = true;
    toast(task ? `Sačuvano. Novi rok zadatka: ${fmtDate(nextDue(task))}` : 'Izveštaj je sačuvan.');
    if (isNew) go(`#/izvestaj/${r.id}`, { replace: true });
    else back(`#/izvestaj/${r.id}`);
  };

  const close = async () => {
    document.activeElement?.blur?.();
    autosave.flush();
    const fallback = r.equipmentId ? `#/oprema/${r.equipmentId}` : '#/izvestaji';
    if (!r.isDraft) {
      // Postojeći izveštaj: izmene su već sačuvane.
      const task = applyCompletion(r);
      await save();
      if (task) await saveTask(task);
      closing = true;
      back(`#/izvestaj/${r.id}`);
      return;
    }
    if (isNew && isEmptyReport(r)) {
      closing = true;
      await deleteReport(r.id);
      back(fallback);
      return;
    }
    const choice = await dialog({
      title: 'Zatvoriti izveštaj?',
      message: 'Nacrt ostaje u listi izveštaja i možete ga dovršiti kasnije. Odbacivanje briše i fotografije.',
      bottom: true,
      buttons: [
        { label: 'Sačuvaj kao nacrt', value: 'draft', style: 'primary' },
        { label: 'Odbaci izveštaj', value: 'discard', style: 'danger' },
        { label: 'Nastavi uređivanje', value: null },
      ],
    });
    if (choice === 'draft') {
      await save();
      closing = true;
      toast('Sačuvano kao nacrt.');
      back(fallback);
    } else if (choice === 'discard') {
      closing = true;
      await deleteReport(r.id);
      toast('Izveštaj je odbačen.');
      back(fallback);
    }
  };

  root.addEventListener('click', async (e) => {
    const choice = e.target.closest('.choice');
    if (choice) {
      const group = choice.closest('[data-choice]');
      const value = choice.dataset.value;
      if (group.dataset.choice === 'type') {
        r.type = value;
        setChoice(group, value, REPORT_TYPES);
        renderTask();
      } else if (group.dataset.choice === 'status') {
        r.status = value;
        setChoice(group, value, REPORT_STATUSES);
        renderTask();
      }
      autosave();
      return;
    }
    const add = e.target.closest('[data-add-min]');
    if (add) {
      const m = +add.dataset.addMin;
      r.durationMinutes = m === 0 ? 0 : (r.durationMinutes || 0) + m;
      root.querySelector('[name="durationMinutes"]').value = r.durationMinutes || '';
      autosave();
      return;
    }
    const part = e.target.closest('[data-part]');
    if (part) {
      const line = `${part.dataset.part} – 1 kom`;
      const cur = (r.parts || '').replace(/\s+$/, '');
      r.parts = cur ? `${cur}\n${line}` : line;
      const ta = root.querySelector('textarea[name="parts"]');
      ta.value = r.parts;
      autoGrow(ta);
      toast(`Upisano: ${part.dataset.part}`, 1400);
      autosave();
      return;
    }
    const ph = e.target.closest('[data-photo-index]');
    if (ph) {
      document.activeElement?.blur?.();
      openViewer({ reportId: r.id, index: +ph.dataset.photoIndex, editable: true, onChange: renderPhotos });
      return;
    }
    if (e.target.closest('[data-finish]')) finish();
    else if (e.target.closest('[data-close]')) close();
  });

  return {
    el: root,
    tab: 'reports',
    fullScreen: true,
    mounted() {
      root.querySelectorAll('textarea').forEach(autoGrow);
      unbind = bindPhotoInputs(root, () => MAX_PHOTOS - photosOf(r.id).length, async (processed) => {
        await addPhoto(processed, { reportId: r.id });
        r.updatedAt = nowISO();
        await saveReport(r);
        renderPhotos();
      });
    },
    flush: () => autosave.flush(),
    async leave() {
      unbind?.();
      autosave.flush();
    },
  };
}

export { isoDateTime, parseDate };

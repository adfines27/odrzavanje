// Katalog opreme: pregled, dodavanje sopstvenih tipova, dopuna ugrađenih tipova
// i dodavanje preporučenog plana održavanja opremi.

import { S, tasksOf, newTask, saveTask, saveCatalogRecord, deleteCatalogRecord } from '../store.js';
import { el, back, go } from '../router.js';
import { navBar, largeTitle, actionBar, toast, confirmDialog, alertDialog } from '../ui.js';
import { icon } from '../icons.js';
import { esc, uid, daysWord, tasksWord, isoDate, fmtDate, addDays, startOfDay, parseDate } from '../util.js';
import { getCatalog, CATALOG_GROUPS, catalogType, catalogRecord, missingTasks, groupIcon } from '../catalog.js';

const NOTE = 'Intervali su orijentacioni. Prilagodite ih uputstvu proizvođača, uslovima rada i propisima.';
const ownTag = '<span class="badge tone-accent" style="padding:1px 7px;font-size:0.72rem">MOJE</span>';

// ---------- Pregled ----------

export function catalogView() {
  const all = getCatalog();
  const root = el(`
    ${navBar({ title: 'Katalog opreme', back: { label: 'Oprema', fallback: '#/oprema' } })}
    ${largeTitle('Katalog opreme')}
    <div class="page">
      <p class="section-footer" style="margin-top:0">Tipovi industrijske elektro opreme sa preporučenim zadacima održavanja i tipičnim rezervnim delovima.
        Možete dodati sopstvene tipove ili dopuniti postojeće (oznaka ${ownTag}). ${NOTE}</p>
      ${CATALOG_GROUPS.map((g) => {
        const items = all.filter((c) => c.group === g.id && c.id !== 'other');
        if (!items.length) return '';
        return `<h2 class="section-title">${esc(g.title)}</h2>
          <div class="group">${items.map((c) => `
            <details class="parts-list">
              <summary class="row">
                <span class="lead-icon">${icon(c.icon)}</span>
                <div class="row-main"><div class="row-title">${esc(c.title)} ${c.builtin ? '' : ownTag}</div>
                  <div class="row-meta">${tasksWord(c.tasks.length)} · ${c.parts.length} delova${c.builtin && (c.tasks.some((x) => x.own) || c.parts.some((x) => x.own)) ? ' · dopunjeno' : ''}</div></div>
                ${icon('chevronRight', 'chev')}
              </summary>
              <div class="cat-body">
                <div class="strong small muted">PLAN ODRŽAVANJA</div>
                ${c.tasks.length ? `<ul>${c.tasks.map((x) => `<li>${esc(x.name)} <span class="faint">– svakih ${daysWord(x.intervalDays)}</span> ${x.own ? ownTag : ''}</li>`).join('')}</ul>` : '<p class="muted small">Nema zadataka.</p>'}
                <div class="strong small muted">REZERVNI DELOVI</div>
                ${c.parts.length ? `<ul>${c.parts.map((p) => `<li>${esc(p.name)} ${p.own ? ownTag : ''}</li>`).join('')}</ul>` : '<p class="muted small">Nema delova.</p>'}
                <a class="btn btn-small btn-block" href="#/katalog/${c.id}" style="margin:4px 0 10px">${icon('pencil')}${c.builtin ? 'Dopuni ovaj tip' : 'Izmeni tip'}</a>
              </div>
            </details>`).join('')}</div>`;
      }).join('')}
    </div>
    ${actionBar(`<a class="btn btn-primary btn-block" href="#/katalog/novi">${icon('plus')}Dodaj novi tip opreme</a>`)}`);
  return { el: root, tab: 'equipment' };
}

// ---------- Dodavanje / izmena tipa ----------

export function catalogEditView(id) {
  const isNew = id === 'novi';
  const base = isNew ? null : getCatalog().find((c) => c.id === id);
  if (!isNew && (!base || base.id === 'other')) return { redirect: '#/katalog' };
  const builtin = !!base?.builtin;
  const rec = isNew ? null : catalogRecord(id);

  // Radna kopija – upisuje se tek na "Sačuvaj".
  const draft = {
    title: isNew ? '' : base.title,
    group: isNew ? 'drives' : base.group,
    tasks: builtin ? [...(rec?.tasks || [])] : isNew ? [] : [...(rec?.tasks || [])],
    parts: builtin ? [...(rec?.parts || [])] : isNew ? [] : [...(rec?.parts || [])],
  };
  const fixedTasks = builtin ? base.tasks.filter((x) => !x.own) : [];
  const fixedParts = builtin ? base.parts.filter((x) => !x.own).map((p) => p.name) : [];
  let attempted = false;

  const root = el(`
    ${navBar({ title: isNew ? 'Novi tip opreme' : builtin ? 'Dopuna tipa' : 'Izmena tipa', alwaysTitle: true,
      left: '<button type="button" class="nav-btn" data-cancel>Otkaži</button>',
      right: '<button type="button" class="nav-btn strong" data-save>Sačuvaj</button>' })}
    <div class="page">
      ${builtin ? `<div class="group mt"><div class="row"><span class="lead-icon">${icon(base.icon)}</span>
          <div class="row-main"><div class="row-title">${esc(base.title)}</div><div class="row-sub">Ugrađeni tip – možete dodati svoje zadatke i delove.</div></div></div></div>`
        : `<h2 class="section-title">Tip opreme</h2>
          <div class="group">
            <label class="field"><span class="label">Naziv tipa</span><input name="title" value="${esc(draft.title)}" placeholder="npr. Elektrofilter, Kompresor, Indukciona peć" enterkeyhint="done"></label>
            <div data-title-error></div>
            <label class="field"><span class="label">Grupa</span><select name="group">
              ${CATALOG_GROUPS.map((g) => `<option value="${g.id}" ${draft.group === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}
            </select></label>
          </div>`}

      <h2 class="section-title">Zadaci održavanja</h2>
      <div class="group" data-tasks></div>
      <div class="group mt">
        <label class="field"><span class="label">Novi zadatak</span><input name="newTask" placeholder="npr. Provera i pritezanje priključaka" enterkeyhint="next"></label>
        <label class="field inline"><span class="label">Interval</span><input name="newInterval" value="365" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done"><span class="unit">dana</span></label>
        <div style="padding:0 16px 10px"><div class="chips">${[30, 90, 180, 365, 730].map((d) => `<button type="button" class="chip" data-iv="${d}">${daysWord(d)}</button>`).join('')}</div></div>
        <div style="padding:0 16px 12px"><button type="button" class="btn btn-block" data-add-task>${icon('plus')}Dodaj zadatak</button></div>
      </div>

      <h2 class="section-title">Rezervni delovi</h2>
      <div class="group" data-parts></div>
      <div class="group mt">
        <label class="field"><span class="label">Novi deo</span><input name="newPart" placeholder="npr. Ležaj 6309-2Z, Kontaktor 25 A" enterkeyhint="done"></label>
        <div style="padding:0 16px 12px"><button type="button" class="btn btn-block" data-add-part>${icon('plus')}Dodaj deo</button></div>
      </div>
      <p class="section-footer">${NOTE}</p>

      ${!isNew && !builtin ? `<div class="group mt-lg"><button type="button" class="row btn-danger strong" data-delete style="justify-content:center">${icon('trash')}Obriši tip</button></div>` : ''}
      ${builtin && (draft.tasks.length || draft.parts.length) ? `<div class="group mt-lg"><button type="button" class="row btn-danger strong" data-reset style="justify-content:center">${icon('trash')}Ukloni sve moje dopune</button></div>` : ''}
    </div>
    ${actionBar(`<button type="button" class="btn btn-primary btn-block" data-save>${icon('check')}Sačuvaj</button>`)}`);

  const delBtn = (kind, i, label) =>
    `<button type="button" class="nav-btn" data-del-${kind}="${i}" aria-label="Ukloni ${esc(label)}" style="color:var(--overdue)">${icon('trash')}</button>`;

  const renderLists = () => {
    const tasksHtml = [
      ...fixedTasks.map((x) => `<div class="row"><div class="row-main"><div>${esc(x.name)}</div><div class="row-meta">Svakih ${daysWord(x.intervalDays)} · iz kataloga</div></div></div>`),
      ...draft.tasks.map((x, i) => `<div class="row"><div class="row-main"><div>${esc(x.name)} ${ownTag}</div><div class="row-meta">Svakih ${daysWord(x.intervalDays)}</div></div>${delBtn('task', i, x.name)}</div>`),
    ];
    root.querySelector('[data-tasks]').innerHTML = tasksHtml.join('') || '<div class="row muted">Još nema zadataka.</div>';
    const partsHtml = [
      ...fixedParts.map((p) => `<div class="row"><div class="row-main">${esc(p)}<div class="row-meta">iz kataloga</div></div></div>`),
      ...draft.parts.map((p, i) => `<div class="row"><div class="row-main">${esc(p)} ${ownTag}</div>${delBtn('part', i, p)}</div>`),
    ];
    root.querySelector('[data-parts]').innerHTML = partsHtml.join('') || '<div class="row muted">Još nema delova.</div>';
  };
  const renderTitleError = () => {
    const box = root.querySelector('[data-title-error]');
    if (!box) return;
    const err = titleError();
    box.innerHTML = attempted && err ? `<div class="field-error" style="padding:0 16px 10px">${icon('overdue')}${esc(err)}</div>` : '';
  };
  const titleError = () => {
    if (builtin) return '';
    const t = draft.title.trim();
    if (!t) return 'Naziv tipa je obavezan.';
    const dup = getCatalog().find((c) => c.id !== id && c.title.trim().toLowerCase() === t.toLowerCase());
    return dup ? 'Tip sa tim nazivom već postoji.' : '';
  };
  renderLists();

  const addTask = () => {
    const nameEl = root.querySelector('[name="newTask"]');
    const ivEl = root.querySelector('[name="newInterval"]');
    const name = nameEl.value.trim();
    const iv = parseInt(ivEl.value.replace(/\D/g, ''), 10);
    if (!name) { nameEl.focus(); return; }
    if (!(iv > 0 && iv <= 3650)) { alertDialog('Interval', 'Unesite broj dana (1–3650).'); return; }
    const all = [...fixedTasks, ...draft.tasks].map((x) => x.name.toLowerCase());
    if (all.includes(name.toLowerCase())) { toast('Taj zadatak već postoji.'); return; }
    draft.tasks.push({ name, intervalDays: iv });
    nameEl.value = '';
    renderLists();
  };
  const addPart = () => {
    const partEl = root.querySelector('[name="newPart"]');
    const name = partEl.value.trim();
    if (!name) { partEl.focus(); return; }
    if ([...fixedParts, ...draft.parts].some((p) => p.toLowerCase() === name.toLowerCase())) { toast('Taj deo već postoji.'); return; }
    draft.parts.push(name);
    partEl.value = '';
    partEl.focus();
    renderLists();
  };

  root.addEventListener('input', (e) => {
    if (e.target.name === 'title') { draft.title = e.target.value; renderTitleError(); }
  });
  root.addEventListener('change', (e) => {
    if (e.target.name === 'group') draft.group = e.target.value;
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.name === 'newPart') { e.preventDefault(); addPart(); }
    else if (e.target.name === 'newTask') { e.preventDefault(); root.querySelector('[name="newInterval"]').focus(); }
    else if (e.target.name === 'newInterval') { e.preventDefault(); addTask(); }
  });

  root.addEventListener('click', async (e) => {
    const iv = e.target.closest('[data-iv]');
    if (iv) { root.querySelector('[name="newInterval"]').value = iv.dataset.iv; return; }
    if (e.target.closest('[data-add-task]')) { addTask(); return; }
    if (e.target.closest('[data-add-part]')) { addPart(); return; }
    const dt = e.target.closest('[data-del-task]');
    if (dt) { draft.tasks.splice(+dt.dataset.delTask, 1); renderLists(); return; }
    const dp = e.target.closest('[data-del-part]');
    if (dp) { draft.parts.splice(+dp.dataset.delPart, 1); renderLists(); return; }

    if (e.target.closest('[data-cancel]')) {
      back('#/katalog');
    } else if (e.target.closest('[data-save]')) {
      attempted = true;
      renderTitleError();
      if (titleError()) return;
      // Nedovršen unos u poljima "novi" – dodaj ga umesto da se izgubi.
      if (root.querySelector('[name="newTask"]').value.trim()) addTask();
      if (root.querySelector('[name="newPart"]').value.trim()) addPart();
      if (builtin) {
        if (draft.tasks.length || draft.parts.length) await saveCatalogRecord({ id, custom: false, tasks: draft.tasks, parts: draft.parts });
        else if (rec) await deleteCatalogRecord(id);
      } else {
        await saveCatalogRecord({ id: isNew ? `c-${uid().slice(0, 8)}` : id, custom: true, title: draft.title.trim(), group: draft.group, tasks: draft.tasks, parts: draft.parts });
      }
      toast(isNew ? 'Novi tip je dodat u katalog.' : 'Katalog je sačuvan.');
      back('#/katalog');
    } else if (e.target.closest('[data-delete]')) {
      const used = [...S.equipment.values()].filter((x) => x.type === id);
      if (used.length) {
        await alertDialog('Tip se koristi', `Ovaj tip je dodeljen opremi: ${used.slice(0, 5).map((x) => x.tag).join(', ')}${used.length > 5 ? ` i još ${used.length - 5}` : ''}. Prvo toj opremi promenite tip, pa obrišite tip.`);
        return;
      }
      const ok = await confirmDialog({ title: `Obrisati tip „${base.title}”?`, message: 'Tip, njegovi zadaci i delovi biće uklonjeni iz kataloga. Plan održavanja postojeće opreme se ne menja.', confirm: 'Obriši tip' });
      if (!ok) return;
      await deleteCatalogRecord(id);
      toast('Tip je obrisan.');
      go('#/katalog', { replace: true });
    } else if (e.target.closest('[data-reset]')) {
      const ok = await confirmDialog({ title: 'Ukloniti moje dopune?', message: `Uklanjaju se zadaci i delovi koje ste dodali tipu „${base.title}”. Ugrađeni deo kataloga i plan postojeće opreme ostaju.`, confirm: 'Ukloni dopune' });
      if (!ok) return;
      await deleteCatalogRecord(id);
      toast('Dopune su uklonjene.');
      back('#/katalog');
    }
  });

  return { el: root, tab: 'equipment', fullScreen: true };
}

// ---------- Preporučeni plan za opremu ----------

export function recommendedPlanView(equipmentId) {
  const eq = S.equipment.get(equipmentId);
  if (!eq) return { redirect: '#/oprema' };
  const cat = catalogType(eq.type);
  const missing = missingTasks(eq.type, tasksOf(eq.id));
  if (!missing.length) return { redirect: `#/oprema/${eq.id}` };
  const today = isoDate(new Date());
  let lastDone = today;
  const selected = new Set(missing.map((_, i) => i));

  const nextFor = (x) => fmtDate(addDays(startOfDay(parseDate(lastDone)), x.intervalDays));

  const root = el(`
    ${navBar({ title: 'Preporučeni plan', alwaysTitle: true, back: { label: 'Otkaži', fallback: `#/oprema/${eq.id}` } })}
    <div class="page">
      <div class="group mt"><div class="row"><span class="lead-icon">${icon(cat.icon || groupIcon(cat.group))}</span>
        <div class="row-main"><div class="row-title">${esc(eq.tag)} · ${esc(eq.name)}</div><div class="row-sub">${esc(cat.title)}</div></div></div></div>

      <h2 class="section-title">Zadaci za dodavanje</h2>
      <div class="group" data-list>
        ${missing.map((x, i) => `<label class="row check-row">
            <input type="checkbox" data-i="${i}" checked>
            <div class="row-main"><div class="row-title">${esc(x.name)} ${x.own ? ownTag : ''}</div>
              <div class="row-sub">Svakih ${daysWord(x.intervalDays)} · prvi rok <span data-next="${i}">${nextFor(x)}</span></div></div>
          </label>`).join('')}
      </div>

      <h2 class="section-title">Poslednje održavanje</h2>
      <div class="group">
        <label class="field inline"><span class="label">Poslednji put urađeno</span><input type="date" name="lastDone" value="${today}" max="${today}"></label>
      </div>
      <p class="section-footer">Isti datum važi za sve izabrane zadatke. Ako ne znate kada je rađeno, ostavite današnji datum – prvi rok biće posle punog intervala. Svaki zadatak kasnije možete pojedinačno izmeniti. ${NOTE}</p>
    </div>
    ${actionBar(`<button type="button" class="btn btn-primary btn-block" data-add>${icon('plus')}<span data-add-label>Dodaj ${tasksWord(selected.size)}</span></button>`)}`);

  const update = () => {
    root.querySelector('[data-add-label]').textContent = selected.size ? `Dodaj ${tasksWord(selected.size)}` : 'Izaberite zadatke';
    root.querySelector('[data-add]').classList.toggle('disabled', !selected.size);
    missing.forEach((x, i) => { root.querySelector(`[data-next="${i}"]`).textContent = nextFor(x); });
  };

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-i]')) {
      if (t.checked) selected.add(+t.dataset.i); else selected.delete(+t.dataset.i);
      update();
    } else if (t.name === 'lastDone') {
      lastDone = t.value || today;
      update();
    }
  });

  root.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-add]') || !selected.size) return;
    for (const i of [...selected].sort((a, b) => a - b)) {
      const x = missing[i];
      await saveTask(Object.assign(newTask(eq.id), { name: x.name, intervalDays: x.intervalDays, lastDoneDate: lastDone }));
    }
    toast(`Dodato u plan: ${tasksWord(selected.size)}.`);
    back(`#/oprema/${eq.id}`);
  });

  return { el: root, tab: 'equipment', fullScreen: true };
}

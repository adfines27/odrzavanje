// Podešavanja: tehničar, podsetnici (kalendar), CSV uvoz, rezervna kopija, primer podataka, skladište.

import { S, settings } from '../store.js';
import { el, rerender } from '../router.js';
import { navBar, largeTitle, confirmDialog, alertDialog, busy, offerFile, onFiles, toast } from '../ui.js';
import { icon } from '../icons.js';
import { esc, bytesText } from '../util.js';
import { decodeText, importEquipmentCSV, importSummary, templateCSV, TEMPLATE_HEADER } from '../csv.js';
import { makeBackup, inspectBackup, restoreBackup } from '../backup.js';
import { tasksToICS } from '../ics.js';
import { hasSampleData, insertSampleData, removeSampleData } from '../seed.js';

const APP_VERSION = '1.0 (web)';

const button = (attr, iconName, label, extra = '') =>
  `<button type="button" class="row strong ${extra}" ${attr} style="color:${extra.includes('danger') ? 'var(--overdue)' : 'var(--accent)'}">${icon(iconName)}<span class="row-main">${esc(label)}</span></button>`;

export function settingsView() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const samples = hasSampleData();
  const photoCount = S.photos.size;

  const root = el(`
    ${navBar({ title: 'Podešavanja' })}
    ${largeTitle('Podešavanja')}
    <div class="page">
      <h2 class="section-title">Podrazumevani tehničar</h2>
      <div class="group">
        <label class="field"><span class="label">Ime i prezime</span>
          <input id="tech" value="${esc(settings.technician)}" autocomplete="name" placeholder="npr. Marko Petrović" enterkeyhint="done"></label>
      </div>
      <p class="section-footer">Automatski se upisuje u svaki novi izveštaj.</p>

      <h2 class="section-title">Podsetnici</h2>
      <div class="group">${button('data-ics', 'calendar', 'Dodaj rokove u kalendar telefona')}</div>
      <p class="section-footer">Pravi kalendarski fajl sa svim rokovima iz plana. Kalendar vas podseća u 08:00 na dan roka i u 08:00 dan ranije, i bez interneta.
        Posle izmene plana izvezite ponovo i obrišite stare događaje u kalendaru.</p>

      <h2 class="section-title">Katalog</h2>
      <div class="group"><a class="row strong" href="#/katalog" style="color:var(--accent)">${icon('book')}<span class="row-main">Katalog opreme i rezervnih delova</span>${icon('chevronRight', 'chev')}</a></div>
      <p class="section-footer">23 tipa industrijske elektro opreme sa preporučenim planom održavanja i tipičnim delovima. Možete dodati sopstvene tipove, zadatke i delove.</p>

      <h2 class="section-title">Uvoz opreme</h2>
      <div class="group">
        <label class="row strong" for="file-csv" role="button" style="color:var(--accent)">${icon('upload')}<span class="row-main">Uvezi opremu iz CSV fajla</span></label>
        ${button('data-template', 'table', 'Preuzmi šablon CSV fajla')}
      </div>
      <p class="section-footer">Kolone: ${esc(TEMPLATE_HEADER.replace(/;/g, '; '))}. Separator zarez ili tačka-zarez.
        Tip: naziv iz kataloga ili kratko (motor, vfd, softstarter, transformator, ormar, mcc, prekidač, agregat, ups, baterija, plc, kabl, rasveta, uzemljenje, pumpa, ventilator…). Postojeća oprema (ista oznaka) se ažurira.</p>

      <h2 class="section-title">Rezervna kopija</h2>
      <div class="group">
        ${button('data-backup', 'archive', 'Izvezi sve podatke i fotografije')}
        <label class="row strong" for="file-backup" role="button" style="color:var(--accent)">${icon('download')}<span class="row-main">Vrati podatke iz rezervne kopije</span></label>
      </div>
      <p class="section-footer">ZIP arhiva sa podacima (podaci.json, oprema.csv) i folderom Fotografije. Čuvajte je redovno u aplikaciji Fajlovi ili na računaru:
        ako se obrišu podaci pregledača, brišu se i podaci aplikacije.</p>

      <h2 class="section-title">Primer podataka</h2>
      <div class="group">
        ${samples ? button('data-remove-samples', 'trash', 'Ukloni primer podataka', 'danger') : button('data-add-samples', 'tray', 'Učitaj primer podataka')}
      </div>
      <p class="section-footer">5 primera opreme sa planom održavanja i 3 izveštaja, za probu aplikacije.</p>

      <h2 class="section-title">O aplikaciji</h2>
      <div class="group">
        <div class="row"><div class="row-main muted">Oprema</div><div class="row-value">${S.equipment.size}</div></div>
        <div class="row"><div class="row-main muted">Izveštaji</div><div class="row-value">${S.reports.size}</div></div>
        <div class="row"><div class="row-main muted">Fotografije</div><div class="row-value">${photoCount}</div></div>
        <div class="row"><div class="row-main muted">Zauzeto prostora</div><div class="row-value" data-usage>…</div></div>
        <div class="row"><div class="row-main muted">Trajno skladište</div><div class="row-value" data-persist>…</div></div>
        <div class="row"><div class="row-main muted">Pokrenuto sa početnog ekrana</div><div class="row-value">${standalone ? 'Da' : 'Ne'}</div></div>
        <div class="row"><div class="row-main muted">Verzija</div><div class="row-value">${APP_VERSION}</div></div>
      </div>
      ${standalone ? '' : `<p class="section-footer">Za rad bez interneta dodajte aplikaciju na početni ekran: Safari → ${icon('share')} Deli → „Dodaj na početni ekran”.
        Važno: podaci u Safariju i u aplikaciji sa početnog ekrana su odvojeni – koristite uvek ikonicu sa početnog ekrana.</p>`}
    </div>`);

  // Tehničar
  root.querySelector('#tech').addEventListener('input', (e) => { settings.technician = e.target.value.trim(); });

  // Skladište
  (async () => {
    try {
      const est = await navigator.storage?.estimate?.();
      root.querySelector('[data-usage]').textContent = est ? bytesText(est.usage || 0) : '—';
      const persisted = await navigator.storage?.persisted?.();
      root.querySelector('[data-persist]').textContent = persisted ? 'Odobreno' : standalone ? 'Aplikacija na početnom ekranu' : 'Nije odobreno';
    } catch {
      root.querySelector('[data-usage]').textContent = '—';
      root.querySelector('[data-persist]').textContent = '—';
    }
  })();

  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-ics]')) {
      const { text, count } = tasksToICS();
      if (!count) { await alertDialog('Nema zadataka', 'Prvo dodajte zadatke u plan održavanja na ekranu opreme.'); return; }
      await offerFile(new Blob([text], { type: 'text/calendar' }), 'Rokovi_odrzavanja.ics', `Rokovi (${count}) su spremni`);
    } else if (e.target.closest('[data-template]')) {
      await offerFile(new Blob([`﻿${templateCSV()}`], { type: 'text/csv' }), 'Oprema_sablon.csv', 'Šablon CSV fajla');
    } else if (e.target.closest('[data-backup]')) {
      try {
        const { blob, fileName } = await busy('Pravim rezervnu kopiju…', makeBackup);
        await offerFile(blob, fileName, 'Rezervna kopija je spremna');
      } catch (err) {
        alertDialog('Rezervna kopija nije napravljena', err?.message || String(err));
      }
    } else if (e.target.closest('[data-add-samples]')) {
      await busy('Učitavam primer podataka…', insertSampleData);
      toast('Primer podataka je učitan.');
      rerender();
    } else if (e.target.closest('[data-remove-samples]')) {
      const ok = await confirmDialog({
        title: 'Ukloniti primer podataka?',
        message: 'Briše se oprema iz primera (M-101, P-201, VFD-301, V-401, FT-501) sa planom, svim njenim izveštajima i fotografijama – uključujući i izveštaje koje ste vi dodali za tu opremu.',
        confirm: 'Ukloni primer podataka',
      });
      if (!ok) return;
      await busy('Brišem…', removeSampleData);
      toast('Primer podataka je uklonjen.');
      rerender();
    }
  });

  return {
    el: root,
    tab: 'settings',
    mounted() {
      onFiles('file-csv', async ([file]) => {
        try {
          const result = await busy('Uvozim…', async () => importEquipmentCSV(await decodeText(file)));
          await alertDialog('Uvoz završen', importSummary(result));
          rerender();
        } catch (err) {
          alertDialog('Uvoz nije uspeo', err?.message || String(err));
        }
      });
      onFiles('file-backup', async ([file]) => {
        try {
          const backup = await busy('Čitam arhivu…', () => inspectBackup(file));
          const d = backup.data;
          const ok = await confirmDialog({
            title: 'Vratiti podatke iz kopije?',
            message: `Kopija sadrži: opreme ${d.equipment?.length || 0}, izveštaja ${d.reports?.length || 0}, fotografija ${d.photos?.length || 0}.\n\nSvi sadašnji podaci na ovom uređaju biće zamenjeni.`,
            confirm: 'Zameni podatke',
          });
          if (!ok) return;
          const res = await busy('Vraćam podatke…', () => restoreBackup(backup));
          await alertDialog('Podaci su vraćeni', `Oprema: ${res.equipment}\nIzveštaji: ${res.reports}\nFotografije: ${res.photos}`);
          rerender();
        } catch (err) {
          alertDialog('Vraćanje nije uspelo', err?.message || String(err));
        }
      });
    },
    leave() {
      onFiles('file-csv', null);
      onFiles('file-backup', null);
    },
  };
}

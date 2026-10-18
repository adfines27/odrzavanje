// Katalog industrijske elektro opreme: preporučeni zadaci održavanja (interval u danima)
// i tipični rezervni delovi / potrošni materijal. Intervali su orijentacioni – prilagodite ih
// uputstvu proizvođača, uslovima rada (prašina, vlaga, temperatura) i propisima.
//
// Postojeće oznake (motor, pump, vfd, valve, instrument, other) se ne menjaju, radi kompatibilnosti.

export const CATALOG_GROUPS = [
  { id: 'drives', title: 'Pogoni i motori' },
  { id: 'distribution', title: 'Razvod i zaštita' },
  { id: 'power', title: 'Napajanje i rezervno napajanje' },
  { id: 'control', title: 'Upravljanje i merenje' },
  { id: 'installation', title: 'Instalacije' },
  { id: 'mechanical', title: 'Mašine sa elektro pogonom' },
  { id: 'misc', title: 'Ostalo' },
];

const t = (name, intervalDays) => ({ name, intervalDays });

const BUILTIN = [
  // ---------- Pogoni i motori ----------
  {
    id: 'motor', group: 'drives', title: 'Elektromotor (asinhroni)', icon: 'equipment',
    tasks: [
      t('Vizuelni pregled, čišćenje rebara i ventilatora', 30),
      t('Merenje vibracija i temperature ležajeva', 30),
      t('Merenje struje po fazama pod opterećenjem', 90),
      t('Podmazivanje ležajeva', 90),
      t('Merenje otpora izolacije namotaja (megerom)', 180),
      t('Provera i pritezanje priključaka u priključnoj kutiji', 180),
      t('Termovizijski pregled', 365),
    ],
    parts: ['Ležaj DE (pogonska strana)', 'Ležaj NDE (zadnja strana)', 'Mast za ležajeve', 'Ventilator motora',
      'Poklopac ventilatora', 'Priključna ploča i mostići', 'Zaptivka priključne kutije', 'Kablovska uvodnica',
      'PTC termistor / Pt100 senzor', 'Grejač protiv kondenzacije', 'Četkice (motor sa kliznim prstenovima)'],
  },
  {
    id: 'vfd', group: 'drives', title: 'Frekventni regulator', icon: 'wave',
    tasks: [
      t('Pregled istorije grešaka i alarma', 30),
      t('Čišćenje hladnjaka i filtera vazduha', 90),
      t('Provera ventilatora hlađenja (rad, buka)', 180),
      t('Provera i pritezanje energetskih priključaka', 365),
      t('Pregled kondenzatora DC kola (nadimanje, curenje)', 365),
      t('Rezervna kopija parametara', 365),
      t('Termovizijski pregled', 365),
    ],
    parts: ['Ventilator hlađenja', 'Filter vazduha (vrata ormara)', 'Kondenzator DC kola', 'Kontrolni panel (tastatura)',
      'Ulazna / izlazna prigušnica', 'Ultrabrzi osigurači', 'Kočioni otpornik', 'Upravljačka ploča / I/O kartica', 'EMC filter'],
  },
  {
    id: 'softstarter', group: 'drives', title: 'Soft starter', icon: 'wave',
    tasks: [
      t('Čišćenje i provera ventilacije', 180),
      t('Provera ventilatora hlađenja', 180),
      t('Provera bajpas kontaktora', 365),
      t('Provera i pritezanje priključaka', 365),
      t('Termovizijski pregled', 365),
    ],
    parts: ['Ventilator hlađenja', 'Bajpas kontaktor', 'Tiristorski modul', 'Upravljačka kartica', 'Ultrabrzi osigurači'],
  },
  {
    id: 'actuator', group: 'drives', title: 'Elektromotorni pogon ventila (aktuator)', icon: 'valve',
    tasks: [
      t('Probni hod otvoreno / zatvoreno', 90),
      t('Provera graničnih i momentnih prekidača', 180),
      t('Provera grejača i zaptivenosti kućišta', 365),
      t('Provera maziva u reduktoru', 365),
    ],
    parts: ['Granični prekidač', 'Momentni prekidač', 'Davač položaja (potenciometar / 4–20 mA)', 'Grejač kućišta',
      'Zaptivke poklopca', 'Motor aktuatora', 'Upravljačka kartica'],
  },

  // ---------- Razvod i zaštita ----------
  {
    id: 'transformer', group: 'distribution', title: 'Energetski transformator', icon: 'transformer',
    tasks: [
      t('Vizuelni pregled (curenje i nivo ulja, izolatori)', 30),
      t('Očitavanje temperature ulja i namotaja', 30),
      t('Provera silikagela u sušniku vazduha', 30),
      t('Merenje otpora izolacije', 365),
      t('Analiza ulja (probojni napon, gasna hromatografija)', 365),
      t('Provera Buchholz releja i termičke zaštite', 365),
      t('Čišćenje izolatora i provera uzemljenja', 365),
      t('Termovizijski pregled', 365),
    ],
    parts: ['Silikagel', 'Transformatorsko ulje', 'Zaptivke poklopca i provodnih izolatora', 'Buchholz relej',
      'Kontaktni termometar', 'Provodni izolator', 'Odvodnik prenapona'],
  },
  {
    id: 'switchgear', group: 'distribution', title: 'SN razvodno postrojenje (ćelije)', icon: 'cabinet',
    tasks: [
      t('Provera signalizacije i indikatora napona', 90),
      t('Provera pritiska SF6 gasa', 90),
      t('Vizuelni pregled i čišćenje ćelija', 180),
      t('Ispitivanje zaštitnih releja', 365),
      t('Provera mehanizma prekidača i brojača operacija', 365),
      t('Podmazivanje pogonskih mehanizama', 365),
      t('Termovizijski pregled', 365),
      t('Merenje prelaznog otpora kontakata', 1095),
    ],
    parts: ['Vakuumska komora', 'Kalem za uključenje', 'Kalem za isključenje', 'Motor za navijanje opruge',
      'Pomoćni kontakti', 'Zaštitni relej', 'Indikator napona', 'SN osigurač', 'Strujni merni transformator'],
  },
  {
    id: 'lvpanel', group: 'distribution', title: 'NN razvodni ormar', icon: 'cabinet',
    tasks: [
      t('Provera signalizacije i mernih instrumenata', 90),
      t('Provera ventilacije i filtera ormara', 90),
      t('Čišćenje i usisavanje ormara', 180),
      t('Test zaštitnih strujnih sklopki (FID)', 180),
      t('Pritezanje vijčanih spojeva sabirnica', 365),
      t('Termovizijski pregled', 365),
    ],
    parts: ['Automatski osigurač', 'Topljivi osigurač (NV)', 'Zaštitna strujna sklopka (FID)', 'Kontaktor',
      'Signalna LED lampa', 'Ventilator ormara', 'Filter ventilatora ormara', 'Odvodnik prenapona', 'Sabirnički nosač'],
  },
  {
    id: 'mcc', group: 'distribution', title: 'MCC ormar (upravljanje motorima)', icon: 'cabinet',
    tasks: [
      t('Čišćenje i vizuelni pregled', 180),
      t('Provera kontaktora (habanje kontakata, buka kalema)', 180),
      t('Provera termičkih releja i podešenja struje', 365),
      t('Pritezanje priključaka', 365),
      t('Funkcionalna proba izvoda', 365),
      t('Termovizijski pregled', 365),
    ],
    parts: ['Kontaktor', 'Kalem kontaktora', 'Pomoćni kontakt', 'Termički relej', 'Motorna zaštitna sklopka',
      'Upravljački transformator', 'Taster / signalna lampa', 'Kontakti izvlačljive fioke'],
  },
  {
    id: 'breaker', group: 'distribution', title: 'Prekidač snage (ACB / MCCB)', icon: 'breaker',
    tasks: [
      t('Probno uključenje i isključenje', 180),
      t('Provera zaštitne jedinice (test okidanja)', 365),
      t('Čišćenje i podmazivanje mehanizma', 365),
      t('Pritezanje priključaka', 365),
      t('Pregled kontakata i lučnih komora', 730),
    ],
    parts: ['Lučna komora', 'Glavni kontakti', 'Kalem za isključenje (šant okidač)', 'Podnaponski okidač',
      'Motor za navijanje', 'Elektronska zaštitna jedinica', 'Pomoćni kontakti'],
  },
  {
    id: 'capacitor', group: 'distribution', title: 'Kompenzacija reaktivne energije', icon: 'capacitor',
    tasks: [
      t('Provera regulatora i faktora snage (cos φ)', 30),
      t('Provera kontaktora kondenzatorskih stupnjeva', 180),
      t('Čišćenje i provera ventilacije', 180),
      t('Merenje kapacitivnosti kondenzatora', 365),
      t('Termovizijski pregled', 365),
    ],
    parts: ['Kondenzatorski stupanj', 'Kontaktor za kondenzatore', 'Prigušnica (filter viših harmonika)',
      'Osigurači stupnjeva', 'Regulator reaktivne energije', 'Ventilator ormara'],
  },

  // ---------- Napajanje ----------
  {
    id: 'generator', group: 'power', title: 'Dizel-električni agregat', icon: 'bolt',
    tasks: [
      t('Probni rad bez opterećenja', 30),
      t('Provera nivoa ulja, goriva i rashladne tečnosti', 30),
      t('Provera akumulatora za start', 30),
      t('Probni rad pod opterećenjem', 90),
      t('Provera automatskog prebacivanja (ATS)', 180),
      t('Zamena ulja i filtera ulja', 365),
      t('Zamena filtera goriva i vazduha', 365),
      t('Merenje otpora izolacije generatora', 365),
    ],
    parts: ['Filter ulja', 'Filter goriva', 'Filter vazduha', 'Motorno ulje', 'Rashladna tečnost', 'Akumulator za start',
      'Klinasti kaiš', 'Regulator napona (AVR)', 'Grejač bloka motora'],
  },
  {
    id: 'ups', group: 'power', title: 'UPS (besprekidno napajanje)', icon: 'battery',
    tasks: [
      t('Pregled alarma i stanja', 30),
      t('Čišćenje i provera ventilatora', 180),
      t('Test baterija (autonomija)', 180),
      t('Provera prebacivanja na bajpas', 365),
      t('Zamena baterija', 1460),
    ],
    parts: ['Baterijski blok 12 V', 'Ventilator', 'Kondenzatori', 'Komunikaciona kartica'],
  },
  {
    id: 'battery', group: 'power', title: 'Stacionarna akumulatorska baterija', icon: 'battery',
    tasks: [
      t('Merenje napona ćelija / blokova', 30),
      t('Provera nivoa elektrolita (otvorene ćelije)', 30),
      t('Provera punjača / ispravljača', 90),
      t('Čišćenje i pritezanje spojeva', 180),
      t('Merenje unutrašnje otpornosti', 180),
      t('Test kapaciteta (pražnjenje)', 365),
    ],
    parts: ['Ćelija / blok baterije', 'Spojnice između ćelija', 'Destilovana voda', 'Vazelin za polove',
      'Modul punjača / ispravljača'],
  },

  // ---------- Upravljanje i merenje ----------
  {
    id: 'plc', group: 'control', title: 'PLC / upravljački ormar', icon: 'cpu',
    tasks: [
      t('Pregled dijagnostike i alarma', 30),
      t('Rezervna kopija programa', 90),
      t('Provera napajanja 24 V DC', 180),
      t('Čišćenje i provera ventilatora i filtera', 180),
      t('Provera priključaka i redne kleme', 365),
      t('Zamena baterije CPU-a', 730),
    ],
    parts: ['Baterija CPU-a', 'Memorijska kartica', 'Napajanje 24 V DC', 'Ulazni / izlazni modul', 'Interfejs relej',
      'Osigurač', 'Filter ventilatora'],
  },
  {
    id: 'instrument', group: 'control', title: 'Merni instrument / senzor', icon: 'gauge',
    tasks: [
      t('Čišćenje senzora', 90),
      t('Provera signala 4–20 mA i prikaza u sistemu', 180),
      t('Kalibracija / verifikacija', 365),
    ],
    parts: ['Senzor / davač', 'Pretvarač signala', 'Kablovska uvodnica', 'Zaštita od prenapona za signal', 'Zaptivke'],
  },

  // ---------- Instalacije ----------
  {
    id: 'cable', group: 'installation', title: 'Kablovi i kablovske trase', icon: 'cable',
    tasks: [
      t('Vizuelni pregled trasa i regala', 180),
      t('Provera kablovskih uvodnica i zaptivanja', 365),
      t('Merenje otpora izolacije kablova', 365),
      t('Termovizija kablovskih završetaka', 365),
    ],
    parts: ['Kablovska stopica', 'Kablovska završnica', 'Kablovska spojnica', 'Kablovska uvodnica', 'Vezice', 'Kablovski regal'],
  },
  {
    id: 'lighting', group: 'installation', title: 'Rasveta i protivpanična rasveta', icon: 'bulb',
    tasks: [
      t('Pregled i zamena neispravnih svetiljki', 30),
      t('Funkcionalni test protivpanične rasvete', 30),
      t('Čišćenje svetiljki', 365),
      t('Test autonomije protivpanične rasvete', 365),
    ],
    parts: ['LED izvor', 'LED drajver', 'Svetiljka', 'Baterija protivpanične svetiljke', 'Senzor pokreta / foto-relej'],
  },
  {
    id: 'grounding', group: 'installation', title: 'Uzemljenje i gromobranska instalacija', icon: 'ground',
    tasks: [
      t('Vizuelni pregled spojeva i hvataljki', 365),
      t('Merenje otpora uzemljenja', 365),
      t('Merenje neprekidnosti zaštitnog provodnika', 365),
    ],
    parts: ['Merni (rastavni) spoj', 'Traka FeZn', 'Hvataljka', 'Ukrsni komad', 'Sonda uzemljivača'],
  },
  {
    id: 'heater', group: 'installation', title: 'Električni grejač', icon: 'flame',
    tasks: [
      t('Merenje otpora i izolacije grejača', 180),
      t('Provera termostata i zaštite od pregrevanja', 180),
      t('Pritezanje priključaka', 365),
    ],
    parts: ['Grejni element', 'Termostat', 'Termički osigurač', 'Kontaktor', 'Senzor temperature (Pt100)'],
  },

  // ---------- Mašine sa elektro pogonom ----------
  {
    id: 'pump', group: 'mechanical', title: 'Pumpa', icon: 'drop',
    tasks: [
      t('Provera curenja na zaptivaču', 30),
      t('Merenje vibracija', 30),
      t('Podmazivanje ležajeva', 90),
      t('Provera poravnanja spojnice', 365),
    ],
    parts: ['Mehanički zaptivač', 'Ležajevi', 'Elastični element spojnice', 'Radno kolo', 'Zaptivke kućišta'],
  },
  {
    id: 'fan', group: 'mechanical', title: 'Ventilator / duvaljka', icon: 'fan',
    tasks: [
      t('Merenje vibracija', 30),
      t('Provera zategnutosti i habanja kaiševa', 90),
      t('Podmazivanje ležajeva', 90),
      t('Čišćenje i balansiranje kola', 365),
    ],
    parts: ['Klinasti kaiš', 'Ležajevi', 'Remenica', 'Elastični element spojnice'],
  },
  {
    id: 'valve', group: 'mechanical', title: 'Ventil', icon: 'valve',
    tasks: [
      t('Provera hoda i zaptivenosti', 90),
      t('Provera pozicionera', 180),
    ],
    parts: ['Pozicioner', 'Zaptivke vretena', 'Membrana', 'Granični prekidači'],
  },
  {
    id: 'crane', group: 'mechanical', title: 'Elektro oprema dizalice', icon: 'crane',
    tasks: [
      t('Provera kočnica', 30),
      t('Provera graničnih prekidača', 30),
      t('Provera komandnog priveska / daljinske komande', 30),
      t('Provera strujnog voda i kolektora', 90),
      t('Godišnji pregled i ispitivanje', 365),
    ],
    parts: ['Kočioni kalem', 'Kočione obloge', 'Granični prekidač', 'Komandni privezak', 'Četkice strujnog voda',
      'Kontaktor'],
  },

  // ---------- Ostalo ----------
  { id: 'other', group: 'misc', title: 'Ostalo', icon: 'wrench', tasks: [], parts: [] },
];

// ---------- Sopstvene dopune (iz baze) ----------
// Zapis za ugrađeni tip: { id, custom: false, tasks: [...], parts: [...] } – samo dodaci.
// Zapis za novi tip:     { id: 'c-…', custom: true, title, group, tasks, parts }.

const GROUP_ICONS = { drives: 'equipment', distribution: 'cabinet', power: 'bolt', control: 'cpu', installation: 'cable', mechanical: 'wrench', misc: 'wrench' };
export const groupIcon = (g) => GROUP_ICONS[g] || 'wrench';

let records = new Map();
let merged = null;

/** Poziva se posle učitavanja baze i posle svake izmene kataloga. */
export function setCatalogRecords(list) {
  records = new Map(list.map((r) => [r.id, r]));
  merged = null;
}
export const catalogRecord = (id) => records.get(id) || null;

/** Ceo katalog: ugrađeni tipovi sa dopunama + sopstveni tipovi. Svaka stavka zna odakle je. */
export function getCatalog() {
  if (merged) return merged;
  const other = BUILTIN[BUILTIN.length - 1];
  const list = BUILTIN.slice(0, -1).map((b) => {
    const ext = records.get(b.id);
    return {
      ...b, builtin: true,
      tasks: [...b.tasks.map((x) => ({ ...x, own: false })), ...(ext?.tasks || []).map((x) => ({ ...x, own: true }))],
      parts: [...b.parts.map((p) => ({ name: p, own: false })), ...(ext?.parts || []).map((p) => ({ name: p, own: true }))],
    };
  });
  for (const r of records.values()) {
    if (!r.custom) continue;
    list.push({
      id: r.id, group: r.group || 'misc', title: r.title, icon: groupIcon(r.group), builtin: false,
      tasks: (r.tasks || []).map((x) => ({ ...x, own: true })),
      parts: (r.parts || []).map((p) => ({ name: p, own: true })),
    });
  }
  list.push({ ...other, builtin: true, tasks: [], parts: [] });
  // Delovi kao niz imena (za izveštaj), zadaci kao { name, intervalDays }.
  merged = list.map((c) => ({ ...c, partNames: c.parts.map((p) => p.name) }));
  return merged;
}

/** <option> lista grupisana po <optgroup>. */
export function typeOptionsHTML(selected, esc) {
  const all = getCatalog();
  return CATALOG_GROUPS.map((g) => {
    const items = all.filter((c) => c.group === g.id);
    if (!items.length) return '';
    return `<optgroup label="${esc(g.title)}">${items.map((c) =>
      `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</optgroup>`;
  }).join('');
}

const norm = (s) => String(s).toLowerCase().trim();

/** Preporučeni zadaci koji još nisu u planu (poređenje po nazivu). */
export function missingTasks(typeId, existingTasks) {
  const have = new Set(existingTasks.map((x) => norm(x.name)));
  return catalogType(typeId).tasks.filter((x) => !have.has(norm(x.name)));
}

export function catalogType(id) {
  const all = getCatalog();
  return all.find((c) => c.id === id) || all[all.length - 1];
}

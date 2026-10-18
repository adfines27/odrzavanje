// Primer podataka za probu: 5 opreme, 7 zadataka (kasni / uskoro / u redu), 3 izveštaja sa fotografijama.
// Sve je označeno sa isSample i može se ukloniti iz Podešavanja.

import { S, newEquipment, newTask, saveEquipment, saveTask, saveReport, addPhoto, savePhotoMeta, deleteEquipment, deleteReport } from './store.js';
import { uid, isoDate, isoDateTime, nowISO, prefs } from './util.js';
import { processImage } from './images.js';

const SEEDED_KEY = 'sampleSeeded_v1';

export const hasSampleData = () =>
  [...S.equipment.values()].some((e) => e.isSample) || [...S.reports.values()].some((r) => r.isSample);

export async function seedIfNeeded() {
  if (prefs.get(SEEDED_KEY, false)) return;
  prefs.set(SEEDED_KEY, true);
  if (S.equipment.size === 0) await insertSampleData();
}

function daysAgo(n, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 30, 0, 0);
  return d;
}

/** Generisana slika 4:3 sa strelicom "GORE" – za proveru orijentacije u PDF-u. */
function placeholder(title, subtitle, label) {
  const colors = { before: '#0d58bf', after: '#157a33', other: '#5a5a60' };
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 900;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1200, 900);
  g.addColorStop(0, '#29334a');
  g.addColorStop(1, colors[label]);
  x.fillStyle = g;
  x.fillRect(0, 0, 1200, 900);
  x.fillStyle = 'rgba(255,255,255,0.85)';
  x.beginPath();
  x.moveTo(1050, 120); x.lineTo(1120, 230); x.lineTo(980, 230); x.closePath();
  x.fill();
  x.fillStyle = '#fff';
  x.textBaseline = 'top';
  x.font = 'bold 34px -apple-system, Helvetica, Arial, sans-serif';
  x.fillText('GORE', 1003, 245);
  x.font = '900 150px -apple-system, Helvetica, Arial, sans-serif';
  x.fillText(title, 80, 300);
  x.font = '600 64px -apple-system, Helvetica, Arial, sans-serif';
  x.fillText(subtitle, 84, 480);
  x.font = 'bold 44px -apple-system, Helvetica, Arial, sans-serif';
  x.fillText(`PRIMER · ${{ before: 'PRE', after: 'POSLE', other: 'OSTALO' }[label]}`, 84, 780);
  return new Promise((res) => c.toBlob((b) => { c.width = c.height = 0; res(b); }, 'image/jpeg', 0.9));
}

async function samplePhoto(reportId, title, subtitle, label, caption) {
  const processed = await processImage(await placeholder(title, subtitle, label));
  const meta = await addPhoto(processed, { reportId });
  meta.label = label;
  meta.caption = caption;
  await savePhotoMeta(meta);
}

export async function insertSampleData() {
  const technician = prefs.get('technician', '') || 'Marko Petrović';
  const eq = (o) => Object.assign(newEquipment(), o, { isSample: true });

  const m101 = eq({ tag: 'M-101', name: 'Elektromotor glavne pumpe', type: 'motor', area: 'Pumpna stanica 1', manufacturer: 'Siemens',
    model: '1LE1503-2AB53', serialNumber: 'UD2103/1234567', ratedPowerKW: 55, notes: 'Ležajevi: 6313-2Z (DE), 6213-2Z (NDE). Mast: SKF LGHP 2.' });
  const p201 = eq({ tag: 'P-201', name: 'Centrifugalna pumpa rashladne vode', type: 'pump', area: 'Rashladni sistem', manufacturer: 'Grundfos',
    model: 'NK 100-250/270', serialNumber: '98765432', ratedPowerKW: 37, notes: 'Mehanički zaptivač 45 mm.' });
  const vfd301 = eq({ tag: 'VFD-301', name: 'Frekventni regulator za M-101', type: 'vfd', area: 'Elektro ormar EO-3', manufacturer: 'ABB',
    model: 'ACS580-01-106A-4', serialNumber: '3AUA0000080418', ratedPowerKW: 55 });
  const v401 = eq({ tag: 'V-401', name: 'Regulacioni ventil pare', type: 'valve', area: 'Kotlarnica', manufacturer: 'Samson',
    model: '3241 DN80', serialNumber: 'S-7741', notes: 'Pozicioner 3730-3.' });
  const ft501 = eq({ tag: 'FT-501', name: 'Elektromagnetni merač protoka', type: 'instrument', area: 'Linija 2', manufacturer: 'Endress+Hauser',
    model: 'Promag W 400', serialNumber: 'N9012345', notes: 'Opseg 0–250 m³/h.' });
  for (const e of [m101, p201, vfd301, v401, ft501]) await saveEquipment(e);

  const task = async (e, name, interval, lastDoneDaysAgo) => {
    const t = Object.assign(newTask(e.id), { name, intervalDays: interval, lastDoneDate: isoDate(daysAgo(lastDoneDaysAgo)) });
    await saveTask(t);
    return t;
  };
  const lubrication = await task(m101, 'Podmazivanje ležajeva', 90, 95); // kasni 5 dana
  await task(m101, 'Merenje otpora izolacije', 180, 40); // u redu
  await task(p201, 'Provera mehaničkog zaptivača', 30, 26); // za 4 dana
  await task(vfd301, 'Čišćenje filtera ventilatora', 60, 62); // kasni 2 dana
  await task(vfd301, 'Termovizijski pregled ormara', 365, 100); // u redu
  await task(v401, 'Provera hoda i zaptivenosti', 90, 85); // za 5 dana
  await task(ft501, 'Verifikacija merača', 365, 200); // u redu

  const report = (o) => ({
    id: uid(), taskId: null, problem: '', findings: '', actions: '', parts: '', durationMinutes: 0, technician,
    isDraft: false, completionApplied: false, createdAt: nowISO(), updatedAt: nowISO(), isSample: true, ...o,
  });

  const r1 = report({ equipmentId: m101.id, taskId: lubrication.id, date: isoDateTime(daysAgo(95, 10)), type: 'preventive', status: 'completed',
    completionApplied: true, durationMinutes: 45,
    problem: 'Redovno podmazivanje ležajeva prema planu održavanja.',
    findings: 'Ležajevi bez povećane buke i vibracija. Temperatura kućišta 48 °C.',
    actions: 'Ubačeno 25 g masti na DE i 18 g na NDE strani. Očišćeni otvori za izlaz stare masti.',
    parts: 'Mast SKF LGHP 2 – 45 g' });
  const r2 = report({ equipmentId: p201.id, date: isoDateTime(daysAgo(2, 13)), type: 'corrective', status: 'inProgress', durationMinutes: 120,
    problem: 'Curenje vode na mehaničkom zaptivaču pumpe.',
    findings: 'Oštećena klizna površina zaptivača. Vratilo bez vidljivih oštećenja.',
    actions: 'Pumpa izolovana i ispražnjena. Demontiran zaptivač. Čeka se rezervni deo.',
    parts: 'Mehanički zaptivač 45 mm (naručen)' });
  const r3 = report({ equipmentId: vfd301.id, date: isoDateTime(daysAgo(1, 8)), type: 'inspection', status: 'open',
    problem: 'Povremeni alarm pregrevanja regulatora (A4290).',
    findings: 'Filter na vratima ormara zaprljan. Temperatura u ormaru 41 °C.' });
  for (const r of [r1, r2, r3]) await saveReport(r);

  await samplePhoto(r1.id, 'M-101', 'Mazalica DE', 'before', 'Mazalica na DE strani pre čišćenja');
  await samplePhoto(r1.id, 'M-101', 'Posle podmazivanja', 'after', 'Očišćeno i podmazano');
  await samplePhoto(r2.id, 'P-201', 'Curenje', 'before', 'Trag curenja ispod zaptivača');
  await samplePhoto(r2.id, 'P-201', 'Zaptivač', 'other', 'Demontiran zaptivač – oštećena površina');
  await samplePhoto(r2.id, 'P-201', 'Natpisna pločica', 'other', '');
}

export async function removeSampleData() {
  for (const e of [...S.equipment.values()].filter((x) => x.isSample)) await deleteEquipment(e.id);
  for (const r of [...S.reports.values()].filter((x) => x.isSample)) await deleteReport(r.id);
}

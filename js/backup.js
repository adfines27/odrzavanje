// Rezervna kopija: ZIP sa podaci.json, oprema.csv i folderom Fotografije. Može i da se vrati.

import * as db from './db.js';
import { S, loadAll, wipeAll } from './store.js';
import { makeZip, readZip } from './zip.js';
import { exportEquipmentCSV } from './csv.js';
import { nowISO } from './util.js';

const FORMAT = 'elektro-odrzavanje-web-backup';

export async function makeBackup() {
  const photos = [...S.photos.values()];
  const data = {
    format: FORMAT,
    version: 1,
    exportedAt: nowISO(),
    equipment: [...S.equipment.values()],
    tasks: [...S.tasks.values()],
    reports: [...S.reports.values()],
    photos: photos.map((p) => ({ ...p, file: `Fotografije/${p.id}.jpg`, thumbFile: `Fotografije/${p.id}_t.jpg` })),
  };
  const entries = [
    { name: 'podaci.json', data: JSON.stringify(data, null, 2) },
    { name: 'oprema.csv', data: exportEquipmentCSV() },
  ];
  for (const p of photos) {
    const blobs = await db.get('photoData', p.id);
    if (!blobs) continue;
    entries.push({ name: `Fotografije/${p.id}.jpg`, data: blobs.full });
    if (blobs.thumb) entries.push({ name: `Fotografije/${p.id}_t.jpg`, data: blobs.thumb });
  }
  const zip = await makeZip(entries);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return { blob: zip, fileName: `ElektroOdrzavanje_kopija_${stamp}.zip`, photoCount: photos.length };
}

/** Pročita arhivu i vrati sažetak, bez menjanja podataka. */
export async function inspectBackup(file) {
  const files = await readZip(file);
  const json = files.get('podaci.json');
  if (!json) throw new Error('U arhivi nema fajla podaci.json.');
  const data = JSON.parse(await json.text());
  if (data.format !== FORMAT) throw new Error('Ova arhiva nije rezervna kopija web verzije aplikacije.');
  return { files, data };
}

/** Briše sve postojeće podatke i učitava kopiju. */
export async function restoreBackup({ files, data }) {
  await wipeAll();
  const ops = [];
  for (const e of data.equipment || []) ops.push({ store: 'equipment', put: e });
  for (const t of data.tasks || []) ops.push({ store: 'tasks', put: t });
  for (const r of data.reports || []) ops.push({ store: 'reports', put: r });
  await db.batch(ops);
  let restoredPhotos = 0;
  for (const p of data.photos || []) {
    const full = files.get(p.file);
    if (!full) continue;
    const thumb = files.get(p.thumbFile) || full;
    const { file, thumbFile, ...meta } = p;
    await db.batch([
      { store: 'photoData', put: { id: meta.id, full: new Blob([full], { type: 'image/jpeg' }), thumb: new Blob([thumb], { type: 'image/jpeg' }) } },
      { store: 'photos', put: meta },
    ]);
    restoredPhotos += 1;
  }
  await loadAll();
  return { equipment: S.equipment.size, reports: S.reports.size, photos: restoredPhotos };
}

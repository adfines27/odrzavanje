// Podaci u memoriji + upis u IndexedDB. Sva brisanja brišu i fotografije.

import * as db from './db.js';
import { getCatalog, catalogType, setCatalogRecords } from './catalog.js';
import { uid, parseDate, isoDate, isoDateTime, nowISO, startOfDay, addDays, daysBetween, compareTag, prefs } from './util.js';

// ---------- Šifarnici ----------

export const REPORT_TYPES = [
  { id: 'preventive', title: 'Preventivno', icon: 'calendarCheck' },
  { id: 'corrective', title: 'Korektivno', icon: 'wrench' },
  { id: 'inspection', title: 'Inspekcija', icon: 'search' },
];
export const REPORT_STATUSES = [
  { id: 'open', title: 'Otvoren', icon: 'open', tone: 'overdue' },
  { id: 'inProgress', title: 'U toku', icon: 'soon', tone: 'soon' },
  { id: 'completed', title: 'Završen', icon: 'ok', tone: 'ok' },
];
export const PHOTO_LABELS = [
  { id: 'before', title: 'Pre' },
  { id: 'after', title: 'Posle' },
  { id: 'other', title: 'Ostalo' },
];
export const DUE = {
  overdue: { title: 'Kasni', icon: 'overdue', tone: 'overdue' },
  soon: { title: 'Uskoro', icon: 'soon', tone: 'soon' },
  ok: { title: 'U redu', icon: 'ok', tone: 'ok' },
};
const byId = (list) => (id) => list.find((x) => x.id === id) || list[list.length - 1];
export const equipmentType = (id) => catalogType(id);
export const reportType = byId(REPORT_TYPES);
export const reportStatus = (id) => REPORT_STATUSES.find((x) => x.id === id) || REPORT_STATUSES[0];
export const photoLabel = byId(PHOTO_LABELS);

const normalizeType = (s) => String(s ?? '').toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

export function parseEquipmentType(value) {
  const raw = String(value ?? '').trim();
  if (getCatalog().some((c) => c.id === raw)) return raw;
  const v = String(value ?? '').toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  if (['motor', 'elektromotor', 'em'].includes(v)) return 'motor';
  if (['pump', 'pumpa'].includes(v)) return 'pump';
  if (['vfd', 'frekventniregulator', 'frekventni', 'regulator', 'pretvarac', 'frekventnipretvarac', 'inverter'].includes(v)) return 'vfd';
  if (['valve', 'ventil', 'zasun', 'slavina'].includes(v)) return 'valve';
  if (['instrument', 'instrumenti', 'merac', 'senzor', 'transmiter'].includes(v)) return 'instrument';
  const aliases = {
    softstarter: ['softstarter', 'mekiupustac', 'softstart'],
    actuator: ['actuator', 'aktuator', 'elektromotornipogon', 'pogonventila'],
    transformer: ['transformer', 'transformator', 'trafo', 'energetskitransformator'],
    switchgear: ['switchgear', 'snpostrojenje', 'srednjinapon', 'celija', 'celije', 'snrazvod', 'postrojenje'],
    lvpanel: ['lvpanel', 'nnormar', 'razvodniormar', 'razvodnatabla', 'nnrazvod', 'ormar', 'razvod'],
    mcc: ['mcc', 'mccormar', 'motorcontrolcenter'],
    breaker: ['breaker', 'prekidac', 'acb', 'mccb', 'prekidacsnage'],
    capacitor: ['capacitor', 'kompenzacija', 'kondenzatori', 'kondenzatorskabaterija'],
    generator: ['generator', 'agregat', 'dizelagregat', 'dea'],
    ups: ['ups', 'besprekidnonapajanje'],
    battery: ['battery', 'baterija', 'akumulator', 'akumulatorskabaterija'],
    plc: ['plc', 'upravljackiormar', 'automatika'],
    cable: ['cable', 'kabl', 'kablovi', 'kablovskatrasa'],
    lighting: ['lighting', 'rasveta', 'osvetljenje', 'svetiljka'],
    grounding: ['grounding', 'uzemljenje', 'gromobran'],
    heater: ['heater', 'grejac', 'elektricnigrejac'],
    fan: ['fan', 'ventilator', 'duvaljka'],
    crane: ['crane', 'dizalica', 'kran'],
  };
  for (const [id, list] of Object.entries(aliases)) if (list.includes(v)) return id;
  const byTitle = getCatalog().find((c) => normalizeType(c.title) === v);
  return byTitle ? byTitle.id : 'other';
}

// ---------- Stanje ----------

export const S = {
  equipment: new Map(),
  tasks: new Map(),
  reports: new Map(),
  photos: new Map(), // samo podaci o fotografiji, bez slike
};

export const settings = {
  get technician() { return prefs.get('technician', ''); },
  set technician(v) { prefs.set('technician', v); },
};

export async function loadAll() {
  const [eq, tasks, reports, photos] = await Promise.all(['equipment', 'tasks', 'reports', 'photos'].map(db.getAll));
  const catalog = await db.getAll('catalog').catch(() => []);
  setCatalogRecords(catalog);
  for (const m of Object.values(S)) m.clear();
  eq.forEach((x) => S.equipment.set(x.id, x));
  tasks.forEach((x) => S.tasks.set(x.id, x));
  reports.forEach((x) => S.reports.set(x.id, x));
  photos.forEach((x) => S.photos.set(x.id, x));
}

// ---------- Upiti ----------

export const equipmentSorted = () => [...S.equipment.values()].sort((a, b) => compareTag(a.tag, b.tag));
export const tasksOf = (eqId) => [...S.tasks.values()].filter((t) => t.equipmentId === eqId).sort((a, b) => nextDue(a) - nextDue(b));
export const reportsSorted = () => [...S.reports.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
export const reportsOf = (eqId) => reportsSorted().filter((r) => r.equipmentId === eqId);
export const photosOf = (reportId) => [...S.photos.values()].filter((p) => p.reportId === reportId)
  .sort((a, b) => a.sortIndex - b.sortIndex || (a.createdAt < b.createdAt ? -1 : 1));
export const plannedTasks = () => [...S.tasks.values()].filter((t) => S.equipment.has(t.equipmentId)).sort((a, b) => nextDue(a) - nextDue(b));

/** Sledeći rok = poslednji put urađeno + interval (dana). */
export const nextDue = (t) => addDays(startOfDay(parseDate(t.lastDoneDate)), Math.max(1, Number(t.intervalDays) || 1));
export const daysUntil = (t, now = new Date()) => daysBetween(now, nextDue(t));
export function dueState(t, now = new Date()) {
  const d = daysUntil(t, now);
  if (d < 0) return 'overdue';
  if (d <= 7) return 'soon';
  return 'ok';
}
export function worstState(eqId, now = new Date()) {
  const order = ['overdue', 'soon', 'ok'];
  const states = tasksOf(eqId).map((t) => dueState(t, now));
  return states.length ? order.find((s) => states.includes(s)) : null;
}

export const isOpenReport = (r) => !r.isDraft && r.status !== 'completed';
export const isEmptyReport = (r) => !(r.problem || '').trim() && !(r.findings || '').trim() &&
  !(r.actions || '').trim() && !(r.parts || '').trim() && photosOf(r.id).length === 0;

export function tagExists(tag, exceptId) {
  const key = tag.trim().toUpperCase();
  return [...S.equipment.values()].some((e) => e.tag.trim().toUpperCase() === key && e.id !== exceptId);
}

// ---------- Upis ----------

export async function saveEquipment(e) { S.equipment.set(e.id, e); await db.put('equipment', e); persistOnce(); }
export async function saveTask(t) { S.tasks.set(t.id, t); await db.put('tasks', t); }
export async function saveReport(r) { S.reports.set(r.id, r); await db.put('reports', r); persistOnce(); }
export async function savePhotoMeta(p) { S.photos.set(p.id, p); await db.put('photos', p); }

// ---------- Katalog (sopstvene dopune) ----------

export async function saveCatalogRecord(rec) {
  await db.put('catalog', rec);
  setCatalogRecords([...(await db.getAll('catalog'))]);
}
export async function deleteCatalogRecord(id) {
  await db.batch([{ store: 'catalog', del: id }]);
  setCatalogRecords([...(await db.getAll('catalog'))]);
}
export const catalogRecordsAll = () => db.getAll('catalog');

export function newEquipment() {
  return {
    id: uid(), tag: '', name: '', type: 'motor', area: '', manufacturer: '', model: '', serialNumber: '',
    ratedPowerKW: null, notes: '', mainPhotoId: null, createdAt: nowISO(), isSample: false,
  };
}

export function newTask(equipmentId) {
  return { id: uid(), equipmentId, name: '', intervalDays: 30, lastDoneDate: isoDate(new Date()), notes: '', createdAt: nowISO() };
}

export async function newDraftReport(equipmentId = null) {
  const r = {
    id: uid(), equipmentId, taskId: null, date: isoDateTime(new Date()),
    type: 'corrective', status: 'open',
    problem: '', findings: '', actions: '', parts: '', durationMinutes: 0,
    technician: settings.technician || '',
    isDraft: true, completionApplied: false,
    createdAt: nowISO(), updatedAt: nowISO(), isSample: false,
  };
  await saveReport(r);
  return r;
}

/** Fotografija iz images.processImage → baza. */
export async function addPhoto(processed, { reportId = null, equipmentId = null } = {}) {
  const siblings = reportId ? photosOf(reportId) : [];
  const meta = {
    id: uid(), reportId, equipmentId,
    caption: '', label: 'other',
    sortIndex: siblings.length ? Math.max(...siblings.map((p) => p.sortIndex)) + 1 : 0,
    width: processed.width, height: processed.height, createdAt: nowISO(),
  };
  await db.batch([
    { store: 'photoData', put: { id: meta.id, full: processed.full, thumb: processed.thumb } },
    { store: 'photos', put: meta },
  ]);
  S.photos.set(meta.id, meta);
  persistOnce();
  return meta;
}

export const photoData = (id) => db.get('photoData', id);

const photoListeners = new Set();
export const onPhotoDeleted = (fn) => photoListeners.add(fn);

function photoDeleteOps(id) {
  photoListeners.forEach((fn) => fn(id));
  S.photos.delete(id);
  return [{ store: 'photos', del: id }, { store: 'photoData', del: id }];
}

export async function deletePhoto(id) {
  const meta = S.photos.get(id);
  await db.batch(photoDeleteOps(id));
  if (meta?.reportId) {
    const rest = photosOf(meta.reportId);
    const ops = [];
    rest.forEach((p, i) => { if (p.sortIndex !== i) { p.sortIndex = i; ops.push({ store: 'photos', put: p }); } });
    await db.batch(ops);
  }
}

export async function deleteReport(id) {
  const ops = photosOf(id).flatMap((p) => photoDeleteOps(p.id));
  ops.push({ store: 'reports', del: id });
  S.reports.delete(id);
  await db.batch(ops);
}

export async function deleteTask(id) {
  const ops = [{ store: 'tasks', del: id }];
  for (const r of S.reports.values()) {
    if (r.taskId === id) { r.taskId = null; ops.push({ store: 'reports', put: r }); }
  }
  S.tasks.delete(id);
  await db.batch(ops);
}

export async function deleteEquipment(id) {
  const e = S.equipment.get(id);
  const ops = [];
  for (const r of reportsOf(id)) {
    ops.push(...photosOf(r.id).flatMap((p) => photoDeleteOps(p.id)), { store: 'reports', del: r.id });
    S.reports.delete(r.id);
  }
  for (const t of tasksOf(id)) { ops.push({ store: 'tasks', del: t.id }); S.tasks.delete(t.id); }
  if (e?.mainPhotoId) ops.push(...photoDeleteOps(e.mainPhotoId));
  ops.push({ store: 'equipment', del: id });
  S.equipment.delete(id);
  await db.batch(ops);
}

/**
 * Preventivni izveštaj sa statusom Završen pomera datum poslednjeg održavanja povezanog zadatka.
 * Primenjuje se jednom po izveštaju i nikad ne vraća datum unazad. Vraća izmenjeni zadatak ili null.
 */
export function applyCompletion(r) {
  if (r.type !== 'preventive' || r.status !== 'completed' || r.completionApplied || !r.taskId) return null;
  const t = S.tasks.get(r.taskId);
  if (!t) return null;
  r.completionApplied = true;
  const reportDay = startOfDay(parseDate(r.date));
  if (reportDay >= startOfDay(parseDate(t.lastDoneDate))) {
    t.lastDoneDate = isoDate(reportDay);
    return t;
  }
  return null;
}

/** Pregled: koji bi bio novi rok ako se izveštaj sada sačuva. */
export function completionPreview(r) {
  const t = r.taskId && S.tasks.get(r.taskId);
  if (!t || r.type !== 'preventive' || r.status !== 'completed' || r.completionApplied) return null;
  const reportDay = startOfDay(parseDate(r.date));
  const last = reportDay >= startOfDay(parseDate(t.lastDoneDate)) ? reportDay : parseDate(t.lastDoneDate);
  return { lastDone: last, next: addDays(startOfDay(last), Math.max(1, Number(t.intervalDays) || 1)) };
}

export async function finalizeReport(r) {
  r.isDraft = false;
  r.technician = (r.technician || '').trim();
  r.updatedAt = nowISO();
  if (r.type !== 'preventive') r.taskId = null;
  const task = applyCompletion(r);
  await saveReport(r);
  if (task) await saveTask(task);
  return task;
}

/** Prazni nacrti (npr. aplikacija ugašena odmah posle "Novi izveštaj"). */
export async function cleanupEmptyDrafts() {
  for (const r of [...S.reports.values()]) {
    if (r.isDraft && isEmptyReport(r)) await deleteReport(r.id);
  }
}

export async function wipeAll() {
  await db.clearAll();
  for (const m of Object.values(S)) m.clear();
}

// Traži od pregledača da ne briše podatke kad ponestane prostora.
let persistAsked = false;
function persistOnce() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

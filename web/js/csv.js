// Uvoz/izvoz opreme u CSV. Zarez ili tačka-zarez (Excel sa srpskim podešavanjima),
// UTF-8 ili Windows-1250, zaglavlja na srpskom ili engleskom. Ista oznaka (tag) = ažuriranje.

import { S, newEquipment, saveEquipment, parseEquipmentType, equipmentSorted } from './store.js';
import { normalizedKey, parseDecimal, fmtNumber } from './util.js';

const FIELDS = {
  tag: ['tag', 'oznaka', 'tagoznaka', 'kks'],
  name: ['naziv', 'name', 'ime', 'opis'],
  type: ['tip', 'type', 'vrsta', 'tipopreme'],
  area: ['lokacija', 'area', 'location', 'oblast', 'pogon', 'zona', 'mesto'],
  manufacturer: ['proizvodjac', 'manufacturer', 'proizvodac'],
  model: ['model', 'modelname'],
  serialNumber: ['serijskibroj', 'serialnumber', 'serial', 'sn', 'serijski', 'fabrickibroj'],
  ratedPowerKW: ['snagakw', 'snaga', 'ratedpowerkw', 'ratedpower', 'powerkw', 'power', 'nominalnasnagakw', 'nominalnasnaga'],
  notes: ['napomena', 'napomene', 'notes', 'note', 'beleske'],
};

export const TEMPLATE_HEADER = 'tag;naziv;tip;lokacija;proizvodjac;model;serijski_broj;snaga_kw;napomena';

export const templateCSV = () => [
  TEMPLATE_HEADER,
  'M-102;Elektromotor ventilatora;motor;Hala A;Siemens;1LE1001-1DB23;SN123456;15,5;Ležajevi 6309-2Z',
  'P-202;Pumpa kondenzata;pumpa;Kotlarnica;Grundfos;CR 10-4;SN998877;4;',
].join('\r\n') + '\r\n';

export async function decodeText(file) {
  let bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1250').decode(bytes);
  }
}

/** RFC 4180: navodnici, "" unutar navodnika, novi redovi unutar polja. */
export function parseCSV(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export async function importEquipmentCSV(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = parseCSV(text, delimiter);
  if (!rows.length) throw new Error('Fajl je prazan.');

  const cols = {};
  rows[0].forEach((h, i) => {
    const key = normalizedKey(h);
    for (const [field, aliases] of Object.entries(FIELDS)) {
      if (aliases.includes(key) && cols[field] === undefined) cols[field] = i;
    }
  });
  if (cols.tag === undefined) throw new Error('Nedostaje kolona "tag" (oznaka opreme).');

  const byTag = new Map([...S.equipment.values()].map((e) => [e.tag.trim().toUpperCase(), e]));
  const result = { inserted: 0, updated: 0, skipped: 0, messages: [] };

  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    const val = (f) => (cols[f] !== undefined && row[cols[f]] !== undefined ? row[cols[f]].trim() : '');
    const tag = val('tag');
    if (!tag) {
      result.skipped += 1;
      result.messages.push(`Red ${r + 1}: nema oznake (tag).`);
      continue;
    }
    const powerText = val('ratedPowerKW');
    let power = parseDecimal(powerText);
    if (Number.isNaN(power)) {
      result.messages.push(`Red ${r + 1}: snaga "${powerText}" nije broj, preskočena.`);
      power = null;
    }
    const existing = byTag.get(tag.toUpperCase());
    if (existing) {
      for (const f of ['name', 'area', 'manufacturer', 'model', 'serialNumber', 'notes']) if (val(f)) existing[f] = val(f);
      if (val('type')) existing.type = parseEquipmentType(val('type'));
      if (power !== null) existing.ratedPowerKW = power;
      await saveEquipment(existing);
      result.updated += 1;
    } else {
      const e = newEquipment();
      Object.assign(e, {
        tag: tag.toUpperCase(), name: val('name') || tag, type: parseEquipmentType(val('type')),
        area: val('area'), manufacturer: val('manufacturer'), model: val('model'),
        serialNumber: val('serialNumber'), ratedPowerKW: power, notes: val('notes'),
      });
      await saveEquipment(e);
      byTag.set(e.tag, e);
      result.inserted += 1;
    }
  }
  return result;
}

export function importSummary(r) {
  let s = `Dodato: ${r.inserted}\nAžurirano: ${r.updated}\nPreskočeno: ${r.skipped}`;
  if (r.messages.length) {
    s += `\n\n${r.messages.slice(0, 5).join('\n')}`;
    if (r.messages.length > 5) s += `\n… i još ${r.messages.length - 5}`;
  }
  return s;
}

export function exportEquipmentCSV() {
  const q = (s) => (/[;"\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [TEMPLATE_HEADER];
  for (const e of equipmentSorted()) {
    lines.push([e.tag, e.name, e.type, e.area, e.manufacturer, e.model, e.serialNumber, fmtNumber(e.ratedPowerKW), e.notes]
      .map((v) => q(String(v ?? ''))).join(';'));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

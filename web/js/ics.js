// Podsetnici preko kalendara telefona: web stranica na iPhone-u ne može sama da zakaže
// obaveštenje bez servera, ali kalendar može. Za svaki zadatak: događaj na dan roka,
// sa podsetnikom u 08:00 tog dana i u 08:00 dan ranije. Radi bez interneta.

import { S, plannedTasks, nextDue } from './store.js';
import { fmtDate } from './util.js';

const pad = (n) => String(n).padStart(2, '0');
const icsDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const icsStamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const escText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Linije duže od 75 bajtova se prelamaju (RFC 5545). */
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function tasksToICS() {
  const stamp = icsStamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Elektro odrzavanje//SR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Održavanje opreme',
  ];
  const tasks = plannedTasks();
  for (const t of tasks) {
    const eq = S.equipment.get(t.equipmentId);
    const due = nextDue(t);
    const end = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1);
    const summary = `Održavanje ${eq.tag}: ${t.name}`;
    const desc = `${eq.name}${eq.area ? ` (${eq.area})` : ''}\nZadatak: ${t.name}\nRok: ${fmtDate(due)}\nInterval: ${t.intervalDays} dana`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${t.id}-${icsDate(due)}@elektro-odrzavanje`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(due)}`,
      `DTEND;VALUE=DATE:${icsDate(end)}`,
      `SUMMARY:${escText(summary)}`,
      `DESCRIPTION:${escText(desc)}`,
      'TRANSP:TRANSPARENT',
      // Celodnevni događaj počinje u 00:00 → +8 h = 08:00 na dan roka, −16 h = 08:00 dan ranije.
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(summary)}`, 'TRIGGER;RELATED=START:PT8H', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(`Sutra: ${summary}`)}`, 'TRIGGER;RELATED=START:-PT16H', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join('\r\n') + '\r\n', count: tasks.length };
}

// Izveštaj u A4 PDF bez spoljnih biblioteka i bez interneta.
// Svaka strana se iscrta na canvas (sistemski font ispravno prikazuje š, đ, č, ć, ž),
// pretvori u JPEG i upakuje u PDF. Fotografije se uklapaju uz očuvan odnos stranica.

import { S, photosOf, reportType, reportStatus, photoLabel, photoData, nextDue } from './store.js';
import { fmtDate, fmtDateTime, durationText, isoDate, parseDate } from './util.js';
import { blobToImage } from './images.js';

const PAGE_W = 595.28; // A4 u tačkama
const PAGE_H = 841.89;
const SCALE = 2.2; // ~158 dpi
const MARGIN = 40;
const FOOTER = 28;
const FONT = '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';
const INK = '#000000';
const MUTED = '#555555';
const RULE = '#bfbfbf';
const FILL = '#f2f2f2';
const LABEL_COLORS = { before: '#0d58bf', after: '#157a33', other: '#5a5a60' };

class Layout {
  constructor({ draw, totalPages, snap }) {
    this.draw = draw;
    this.totalPages = totalPages;
    this.snap = snap;
    this.page = 0;
    this.y = 0;
    this.ctx = null;
    this.pages = [];
    this.measureCtx = document.createElement('canvas').getContext('2d');
  }

  get contentW() { return PAGE_W - MARGIN * 2; }
  get bottom() { return PAGE_H - MARGIN - FOOTER; }

  font(size, weight = 400) { return `${weight} ${size}px ${FONT}`; }

  measure(text, size, weight) {
    const c = this.ctx || this.measureCtx;
    c.font = this.font(size, weight);
    return c.measureText(text).width;
  }

  async newPage() {
    if (this.draw && this.ctx) await this.finishPage();
    this.page += 1;
    this.y = MARGIN;
    if (this.draw) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(PAGE_W * SCALE);
      canvas.height = Math.round(PAGE_H * SCALE);
      const ctx = canvas.getContext('2d');
      ctx.scale(SCALE, SCALE);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);
      ctx.textBaseline = 'top';
      this.ctx = ctx;
      this.canvas = canvas;
      this.drawFooter();
    }
  }

  async finishPage() {
    const canvas = this.canvas;
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
    this.pages.push({ bytes: new Uint8Array(await blob.arrayBuffer()), w: canvas.width, h: canvas.height });
    canvas.width = canvas.height = 0;
    this.ctx = null;
  }

  async ensure(h) { if (this.y + h > this.bottom) await this.newPage(); }

  text(str, x, y, size, weight = 400, color = INK) {
    if (!this.draw) return;
    this.ctx.font = this.font(size, weight);
    this.ctx.fillStyle = color;
    this.ctx.fillText(str, x, y);
  }

  line(x1, y1, x2, y2) {
    if (!this.draw) return;
    const c = this.ctx;
    c.strokeStyle = RULE;
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }

  drawFooter() {
    const fy = PAGE_H - MARGIN - 10;
    this.line(MARGIN, fy - 8, MARGIN + this.contentW, fy - 8);
    this.text(`Elektro održavanje · ${this.snap.tag} · ${fmtDate(this.snap.date)}`, MARGIN, fy, 8.5, 400, MUTED);
    const right = `Strana ${this.page} od ${Math.max(this.totalPages, this.page)}`;
    this.text(right, MARGIN + this.contentW - this.measure(right, 8.5, 400), fy, 8.5, 400, MUTED);
  }

  /** Prelama tekst u redove zadate širine (poštuje nove redove; predugačke reči lomi). */
  wrap(text, width, size, weight = 400) {
    const lines = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(''); continue; }
      let cur = '';
      for (let word of words) {
        while (this.measure(word, size, weight) > width) {
          let i = word.length - 1;
          while (i > 1 && this.measure(word.slice(0, i), size, weight) > width) i -= 1;
          if (cur) { lines.push(cur); cur = ''; }
          lines.push(word.slice(0, i));
          word = word.slice(i);
        }
        const test = cur ? `${cur} ${word}` : word;
        if (this.measure(test, size, weight) <= width) cur = test;
        else { lines.push(cur); cur = word; }
      }
      lines.push(cur);
    }
    return lines;
  }

  async paragraph(text, size = 11, weight = 400) {
    const lh = size * 1.38;
    for (const ln of this.wrap(text, this.contentW, size, weight)) {
      await this.ensure(lh);
      this.text(ln, MARGIN, this.y, size, weight);
      this.y += lh;
    }
  }

  async sectionTitle(title) {
    await this.ensure(22);
    this.text(title.toUpperCase(), MARGIN, this.y, 9.5, 700, MUTED);
    this.y += 14;
    this.line(MARGIN, this.y, MARGIN + this.contentW, this.y);
    this.y += 7;
  }

  async section(title, body) {
    const text = (body || '').trim() || '—';
    await this.ensure(44); // naslov ostaje uz bar jedan red teksta
    await this.sectionTitle(title);
    await this.paragraph(text);
    this.y += 10;
  }

  async header() {
    const s = this.snap;
    this.text('IZVEŠTAJ O ODRŽAVANJU', MARGIN, this.y, 18, 800);
    this.y += 26;
    const eqLine = s.equipmentName ? `${s.tag} – ${s.equipmentName}` : s.tag;
    for (const ln of this.wrap(eqLine, this.contentW, 14, 650)) {
      this.text(ln, MARGIN, this.y, 14, 650);
      this.y += 19;
    }
    this.y += 8;

    const rows = [
      ['Datum i vreme', fmtDateTime(s.date)],
      ['Vrsta', s.typeTitle],
      ['Status', s.statusTitle],
      ['Tehničar', s.technician || '—'],
      ['Lokacija', s.area || '—'],
      ['Trajanje', durationText(s.duration)],
    ];
    if (s.taskName) rows.push(['Zadatak iz plana', s.taskName]);
    if (s.nextDue) rows.push(['Sledeći rok zadatka', s.nextDue]);

    const colW = this.contentW / 2;
    const rowH = 32;
    const boxH = Math.ceil(rows.length / 2) * rowH + 8;
    await this.ensure(boxH);
    if (this.draw) {
      const c = this.ctx;
      c.fillStyle = FILL;
      c.strokeStyle = RULE;
      c.lineWidth = 0.5;
      c.beginPath();
      c.roundRect ? c.roundRect(MARGIN, this.y, this.contentW, boxH, 6) : c.rect(MARGIN, this.y, this.contentW, boxH);
      c.fill();
      c.stroke();
    }
    rows.forEach(([k, v], i) => {
      const x = MARGIN + 10 + (i % 2) * colW;
      const y = this.y + 7 + Math.floor(i / 2) * rowH;
      this.text(k.toUpperCase(), x, y, 7.5, 700, MUTED);
      let val = v;
      while (val.length > 1 && this.measure(val, 11, 500) > colW - 20) val = `${val.slice(0, -2)}…`;
      this.text(val, x, y + 11, 11, 500);
    });
    this.y += boxH + 14;
  }

  async photos(images) {
    const list = this.snap.photos;
    if (!list.length) return;
    const gap = 16;
    const cellW = (this.contentW - gap) / 2;
    const imageH = Math.floor(cellW * 0.75);
    const capSize = 9.5;
    const capLH = capSize * 1.3;
    const captionLines = (c) => (c.trim() ? this.wrap(c.trim(), cellW, capSize).slice(0, 3) : []);

    for (let i = 0; i < list.length; i += 2) {
      const row = list.slice(i, i + 2);
      const capH = Math.max(...row.map((p) => captionLines(p.caption).length)) * capLH;
      const rowH = imageH + (capH ? capH + 6 : 0) + 16;
      if (i === 0) {
        await this.ensure(30 + rowH);
        await this.sectionTitle(`Fotografije (${list.length})`);
        this.y += 3;
      } else {
        await this.ensure(rowH);
      }
      row.forEach((p, col) => {
        const x = MARGIN + col * (cellW + gap);
        this.photoCell(p, images[i + col], x, this.y, cellW, imageH, captionLines(p.caption), capSize, capLH);
      });
      this.y += rowH;
    }
  }

  photoCell(p, img, x, y, w, h, capLines, capSize, capLH) {
    if (!this.draw) return;
    const c = this.ctx;
    c.fillStyle = FILL;
    c.fillRect(x, y, w, h);
    if (img) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const s = Math.min(w / iw, h / ih);
      const dw = iw * s;
      const dh = ih * s;
      c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else {
      const msg = 'Fotografija nije dostupna';
      this.text(msg, x + (w - this.measure(msg, 9, 400)) / 2, y + h / 2 - 5, 9, 400, MUTED);
    }
    c.strokeStyle = RULE;
    c.lineWidth = 0.5;
    c.strokeRect(x, y, w, h);

    const label = photoLabel(p.label).title.toUpperCase();
    const lw = this.measure(label, 8.5, 800) + 12;
    c.fillStyle = LABEL_COLORS[p.label] || LABEL_COLORS.other;
    c.fillRect(x + 6, y + 6, lw, 16);
    this.text(label, x + 12, y + 9.5, 8.5, 800, '#ffffff');

    capLines.forEach((ln, i) => this.text(ln, x, y + h + 6 + i * capLH, capSize));
  }
}

function snapshot(report) {
  const eq = S.equipment.get(report.equipmentId);
  const task = report.type === 'preventive' && report.taskId ? S.tasks.get(report.taskId) : null;
  return {
    tag: eq?.tag || '—',
    equipmentName: eq?.name || '',
    area: eq?.area || '',
    date: report.date,
    typeTitle: reportType(report.type).title,
    statusTitle: report.isDraft ? 'Nacrt' : reportStatus(report.status).title,
    technician: report.technician,
    duration: report.durationMinutes,
    taskName: task?.name || null,
    nextDue: task ? fmtDate(nextDue(task)) : null,
    problem: report.problem,
    findings: report.findings,
    actions: report.actions,
    parts: report.parts,
    photos: photosOf(report.id).map((p) => ({ id: p.id, caption: p.caption || '', label: p.label })),
  };
}

async function run(layout, images) {
  await layout.newPage();
  await layout.header();
  await layout.section('Opis problema / rada', layout.snap.problem);
  await layout.section('Nalaz', layout.snap.findings);
  await layout.section('Preduzete mere', layout.snap.actions);
  await layout.section('Utrošeni delovi', layout.snap.parts);
  await layout.photos(images);
  if (layout.draw) await layout.finishPage();
  return layout.page;
}

export async function reportToPDF(report) {
  const snap = snapshot(report);
  const loaded = [];
  for (const p of snap.photos) {
    const data = await photoData(p.id);
    loaded.push(data?.full ? await blobToImage(data.full).catch(() => null) : null);
  }
  const images = loaded.map((x) => x?.img || null);
  try {
    // Prvi prolaz samo broji strane ("Strana X od Y"), drugi crta.
    const total = await run(new Layout({ draw: false, totalPages: 0, snap }), images);
    const layout = new Layout({ draw: true, totalPages: total, snap });
    await run(layout, images);
    const blob = buildPDF(layout.pages, `Izveštaj o održavanju ${snap.tag}`, snap.technician);
    const day = isoDate(parseDate(report.date));
    const safeTag = snap.tag.replace(/[^\w.-]+/g, '_');
    return { blob, fileName: `Izvestaj_${safeTag}_${day}.pdf` };
  } finally {
    loaded.forEach((x) => x?.release());
  }
}

// ---------- Minimalni PDF: svaka strana je jedna JPEG slika ----------

function pdfString(s) {
  // UTF-16BE sa BOM, kao heks string – podržava sve srpske znakove.
  let hex = 'FEFF';
  for (const ch of String(s)) {
    const code = ch.codePointAt(0);
    if (code > 0xffff) continue;
    hex += code.toString(16).padStart(4, '0').toUpperCase();
  }
  return `<${hex}>`;
}

export function buildPDF(pages, title, author) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let pos = 0;
  const push = (x) => {
    const b = typeof x === 'string' ? enc.encode(x) : x;
    parts.push(b);
    pos += b.length;
  };
  const startObj = (n) => { offsets[n] = pos; push(`${n} 0 obj\n`); };

  push('%PDF-1.4\n%âãÏÓ\n');
  const pageObjs = pages.map((_, i) => 4 + i * 3);

  startObj(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObj(2);
  push(`<< /Type /Pages /Kids [${pageObjs.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`);
  startObj(3);
  push(`<< /Title ${pdfString(title)} /Author ${pdfString(author || '')} /Creator ${pdfString('Elektro održavanje')} >>\nendobj\n`);

  pages.forEach((p, i) => {
    const pageN = 4 + i * 3;
    const contentN = pageN + 1;
    const imageN = pageN + 2;
    startObj(pageN);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im${i} ${imageN} 0 R >> >> /Contents ${contentN} 0 R >>\nendobj\n`);
    const content = `q\n${PAGE_W} 0 0 ${PAGE_H} 0 0 cm\n/Im${i} Do\nQ\n`;
    startObj(contentN);
    push(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
    startObj(imageN);
    push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
    push(p.bytes);
    push('\nendstream\nendobj\n');
  });

  const count = 4 + pages.length * 3;
  const xrefPos = pos;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n += 1) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

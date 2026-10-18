// Obrada fotografija: max 1600 px po dužoj ivici, JPEG ~0,75, sličica 400 px.
// Crtanjem <img> u canvas pregledač primenjuje EXIF orijentaciju, pa je slika uvek uspravna
// i bez metapodataka (bez GPS lokacije).

export const MAX_PIXEL = 1600;
export const THUMB_PIXEL = 400;
export const JPEG_QUALITY = 0.75;

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Fotografija nije mogla da se pročita.')); };
    img.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Fotografija nije mogla da se sačuva.'))), 'image/jpeg', quality);
  });
}

/** Smanjivanje u koracima (po pola) daje oštriju sliku od jednog velikog skoka. */
function drawScaled(source, sw, sh, w, h) {
  let src = source;
  let cw = sw;
  let ch = sh;
  while (cw / 2 >= w && ch / 2 >= h) {
    const step = document.createElement('canvas');
    step.width = Math.round(cw / 2);
    step.height = Math.round(ch / 2);
    const sctx = step.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, 0, 0, step.width, step.height);
    if (src !== source) src.width = src.height = 0;
    src = step;
    cw = step.width;
    ch = step.height;
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  if (src !== source) src.width = src.height = 0;
  return out;
}

async function resized(img, sw, sh, max, quality) {
  const r = Math.min(1, max / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * r));
  const h = Math.max(1, Math.round(sh * r));
  const canvas = drawScaled(img, sw, sh, w, h);
  const blob = await canvasToBlob(canvas, quality);
  canvas.width = canvas.height = 0; // oslobađa memoriju (bitno na iPhone-u)
  return { blob, w, h };
}

/** File/Blob → { full, thumb, width, height } */
export async function processImage(file) {
  const { img, url } = await loadImage(file);
  try {
    if (img.decode) await img.decode().catch(() => {});
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    if (!sw || !sh) throw new Error('Fotografija nije mogla da se pročita.');
    const full = await resized(img, sw, sh, MAX_PIXEL, JPEG_QUALITY);
    const thumb = await resized(img, sw, sh, THUMB_PIXEL, 0.7);
    return { full: full.blob, thumb: thumb.blob, width: full.w, height: full.h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Blob slike → HTMLImageElement (za PDF). */
export async function blobToImage(blob) {
  const { img, url } = await loadImage(blob);
  if (img.decode) await img.decode().catch(() => {});
  return { img, release: () => URL.revokeObjectURL(url) };
}

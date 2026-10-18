// Dugmad "Slikaj" i "Iz galerije" + obrada izabranih fotografija.
// <label for> direktno otvara sistemsku kameru / izbor fotografija (bez traženja pristupa celoj galeriji).

import { onFiles, alertDialog } from '../ui.js';
import { icon } from '../icons.js';
import { processImage } from '../images.js';

export function photoButtons(remaining) {
  const off = remaining <= 0 ? 'disabled' : '';
  return `<div class="photo-buttons">
      <label class="btn btn-primary ${off}" for="file-camera" role="button">${icon('camera')}Slikaj</label>
      <label class="btn ${off}" for="file-gallery" role="button">${icon('image')}Iz galerije</label>
    </div>
    <div class="processing" data-processing hidden><span class="spinner"></span><span data-processing-text>Obrada fotografija…</span></div>
    ${remaining <= 0 ? '<p class="section-footer" style="padding:0 12px 12px">Dostignut je maksimum fotografija.</p>' : ''}`;
}

/**
 * Povezuje globalne <input type="file"> sa ovim ekranom.
 * getRemaining: () => broj; onProcessed: async (processed) => void
 */
export function bindPhotoInputs(root, getRemaining, onProcessed) {
  const handler = async (files) => {
    const remaining = getRemaining();
    if (remaining <= 0) return;
    const list = files.slice(0, remaining);
    const box = root.querySelector('[data-processing]');
    const label = root.querySelector('[data-processing-text]');
    if (box) box.hidden = false;
    let failed = 0;
    for (let i = 0; i < list.length; i += 1) {
      if (label) label.textContent = list.length > 1 ? `Obrada fotografija… ${i + 1}/${list.length}` : 'Obrada fotografije…';
      try {
        await onProcessed(await processImage(list[i]));
      } catch (e) {
        console.error(e);
        failed += 1;
      }
    }
    if (box) box.hidden = true;
    if (files.length > remaining) {
      await alertDialog('Previše fotografija', `Dodato je ${list.length}. Izveštaj može da ima najviše 10 fotografija.`);
    }
    if (failed) {
      await alertDialog('Fotografije', `${failed} od ${list.length} fotografija nije moglo da se učita.`);
    }
  };
  onFiles('file-camera', handler);
  onFiles('file-gallery', handler);
  return () => { onFiles('file-camera', null); onFiles('file-gallery', null); };
}

export const cameraHelp = 'Ako se kamera ne otvori, dozvolite pristup: iOS Podešavanja › Safari › Kamera › Dozvoli.';

import { SLOT_ASPECT } from './layouts';

/** Center-crops an uploaded image to the slot aspect and returns a JPEG data URL. */
export async function fileToShot(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that image.'));
      i.src = url;
    });

    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (sw / sh > SLOT_ASPECT) sw = Math.round(sh * SLOT_ASPECT);
    else sh = Math.round(sw / SLOT_ASPECT);
    const sx = Math.round((img.naturalWidth - sw) / 2);
    const sy = Math.round((img.naturalHeight - sh) / 2);

    const outW = Math.min(sw, 1920);
    const outH = Math.round(outW / SLOT_ASPECT);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

import type { Slot, Template } from './events';

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_DIM = 8000;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = url;
  });
}

/** Reads dimensions and validates an uploaded template image. */
export async function readTemplateFile(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a PNG image.');
  if (file.size > MAX_BYTES) throw new Error('That file is too large (max 25 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM) {
      throw new Error(`That image is too big (max ${MAX_DIM}px on either side).`);
    }
    return { blob: file, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Orders slots top-to-bottom, then left-to-right within each row. */
export function sortSlots(slots: Slot[]): Slot[] {
  const byY = [...slots].sort((a, b) => a.y - b.y);
  const rows: Slot[][] = [];
  for (const s of byY) {
    const row = rows[rows.length - 1];
    if (row && s.y - row[0].y < row[0].h / 2) row.push(s);
    else rows.push([s]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x));
}

/** Finds rectangular transparent windows in the PNG and returns their bounding boxes. */
export async function detectSlots(blob: Blob): Promise<Slot[]> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 400 / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const open = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) open[i] = data[i * 4 + 3] < 24 ? 1 : 0;

    const boxes: { minX: number; minY: number; maxX: number; maxY: number; area: number }[] = [];
    for (let start = 0; start < open.length; start++) {
      if (open[start] !== 1) continue;
      const box = { minX: w, minY: h, maxX: 0, maxY: 0, area: 0 };
      const stack = [start];
      open[start] = 2;
      while (stack.length) {
        const p = stack.pop() as number;
        const x = p % w;
        const y = (p - x) / w;
        box.area++;
        if (x < box.minX) box.minX = x;
        if (x > box.maxX) box.maxX = x;
        if (y < box.minY) box.minY = y;
        if (y > box.maxY) box.maxY = y;
        if (x > 0 && open[p - 1] === 1) (open[p - 1] = 2), stack.push(p - 1);
        if (x < w - 1 && open[p + 1] === 1) (open[p + 1] = 2), stack.push(p + 1);
        if (y > 0 && open[p - w] === 1) (open[p - w] = 2), stack.push(p - w);
        if (y < h - 1 && open[p + w] === 1) (open[p + w] = 2), stack.push(p + w);
      }
      boxes.push(box);
    }

    let kept = boxes.filter((b) => b.area >= w * h * 0.01);
    const isWholeCanvas = (b: (typeof boxes)[number]) => b.maxX - b.minX + 1 >= w * 0.98 && b.maxY - b.minY + 1 >= h * 0.98;
    if (kept.length > 1) kept = kept.filter((b) => !isWholeCanvas(b));

    const sx = img.naturalWidth / w;
    const sy = img.naturalHeight / h;
    return sortSlots(
      kept.map((b) => ({
        x: Math.floor(b.minX * sx),
        y: Math.floor(b.minY * sy),
        w: Math.ceil((b.maxX - b.minX + 1) * sx),
        h: Math.ceil((b.maxY - b.minY + 1) * sy),
      })),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Numbered gradient images used to preview a template without a camera. */
export function placeholderShots(count: number): string[] {
  const hues = [200, 40, 340, 140, 270, 20];
  return Array.from({ length: count }, (_, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const hue = hues[i % hues.length];
    const g = ctx.createLinearGradient(0, 0, 800, 600);
    g.addColorStop(0, `hsl(${hue} 80% 60%)`);
    g.addColorStop(1, `hsl(${hue + 40} 70% 35%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 260px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), 400, 310);
    return canvas.toDataURL('image/jpeg', 0.8);
  });
}

export function defaultSlot(t: Pick<Template, 'width' | 'height'>): Slot {
  const w = Math.round(t.width * 0.5);
  const h = Math.round(w * 0.75);
  return { x: Math.round((t.width - w) / 2), y: Math.round((t.height - h) / 2), w, h };
}

import { BASE_PATH } from './basePath';
import type { Template } from './events';
import { applyOps, filterCss, getOps, supportsCtxFilter, type FilterId } from './filters';
import { LAYOUTS, type LayoutId } from './layouts';
import { EMOJI_FONT, type Sticker } from './stickers';

const PADDING = 40;
const GAP = 24;
const WATERMARK_H = 120;
const RADIUS = 16;
const CYAN = '#7DE3FF';
const NAVY = '#0B1226';

export interface ComposeOptions {
  layout: LayoutId;
  shots: string[];
  frameColor: string;
  watermark: boolean;
  filter?: FilterId;
  caption?: string;
  showDate?: boolean;
  glow?: boolean;
  stickers?: Sticker[];
  /** Active event; its name and date are drawn in the footer. */
  eventInfo?: { name: string; date: string };
  /** Required when layout is 'custom'. */
  template?: Template | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

type Drawable = HTMLImageElement | HTMLCanvasElement;

function drawCover(ctx: CanvasRenderingContext2D, img: Drawable, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function drawFiltered(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  filter: FilterId,
  native: boolean,
) {
  if (filter === 'none') {
    drawCover(ctx, img, x, y, w, h);
  } else if (native) {
    ctx.filter = filterCss(filter) ?? 'none';
    drawCover(ctx, img, x, y, w, h);
    ctx.filter = 'none';
  } else {
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d');
    if (!tctx) return;
    drawCover(tctx, img, 0, 0, w, h);
    const data = tctx.getImageData(0, 0, w, h);
    applyOps(data, getOps(filter));
    tctx.putImageData(data, 0, 0);
    ctx.drawImage(tmp, x, y);
  }
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

function drawFittedText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, weight: number, maxWidth: number, family: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 18) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  ctx.fillText(text, cx, cy);
}

async function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, textColor: string) {
  const logo = await loadImage(`${BASE_PATH}/logo.svg`);
  const logoSize = 64;
  const label = 'Kameramera';
  ctx.font = `700 40px ${getComputedStyle(document.body).fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const total = logoSize + 16 + ctx.measureText(label).width;
  const startX = (width - total) / 2;
  const centerY = height - PADDING - WATERMARK_H / 2;

  ctx.drawImage(logo, startX, centerY - logoSize / 2, logoSize, logoSize);
  ctx.fillStyle = textColor;
  ctx.fillText(label, startX + logoSize + 16, centerY + 2);
}

function drawStickers(ctx: CanvasRenderingContext2D, stickers: Sticker[], width: number, height: number, color: string) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  for (const s of stickers) {
    ctx.font = `${Math.round(s.size * width)}px ${EMOJI_FONT}`;
    ctx.fillText(s.emoji, s.x * width, s.y * height);
  }
}

async function composeTemplate(template: Template, shots: string[], filter: FilterId, stickers: Sticker[]): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const url = URL.createObjectURL(template.blob);
  try {
    const frame = await loadImage(url);
    const images = await Promise.all(shots.slice(0, template.slots.length).map(loadImage));
    const native = supportsCtxFilter();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (template.mode === 'background') ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);

    images.forEach((img, i) => {
      const s = template.slots[i];
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      const w = Math.max(1, Math.round(s.w));
      const h = Math.max(1, Math.round(s.h));
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      drawFiltered(ctx, img, x, y, w, h, filter, native);
      ctx.restore();
    });

    if (template.mode === 'overlay') ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }

  drawStickers(ctx, stickers, canvas.width, canvas.height, '#000000');
  return canvas;
}

const formatDate = (d: Date) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

function fontFamily(cssVar: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return v ? `${v}, sans-serif` : 'sans-serif';
}

/** Headline in Montserrat, details in Open Sans; waits until both are loaded for canvas use. */
async function loadTextFonts() {
  const heading = fontFamily('--font-montserrat');
  const body = fontFamily('--font-open-sans');
  await Promise.all([document.fonts.load(`800 56px ${heading}`), document.fonts.load(`400 34px ${body}`)]).catch(() => {});
  return { heading, body };
}

export async function composeImage({
  layout,
  shots,
  frameColor,
  watermark,
  filter = 'none',
  caption = '',
  showDate = false,
  glow = false,
  stickers = [],
  eventInfo,
  template,
}: ComposeOptions): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const fonts = await loadTextFonts();

  if (layout === 'custom') {
    if (!template) throw new Error('Missing event template');
    return composeTemplate(template, shots, filter, stickers);
  }

  const def = LAYOUTS[layout];
  const captionText = caption.trim();
  const dateText = eventInfo
    ? formatDate(new Date(`${eventInfo.date}T00:00:00`))
    : showDate
      ? formatDate(new Date())
      : '';
  const mainText = captionText || eventInfo?.name || '';
  const subText = [captionText ? eventInfo?.name : '', dateText].filter(Boolean).join('  ·  ');
  const textH = mainText || subText ? 16 + (mainText ? 72 : 0) + (subText ? 52 : 0) : 0;

  const gridH = def.rows * def.slotH + (def.rows - 1) * GAP;
  const width = PADDING * 2 + def.cols * def.slotW + (def.cols - 1) * GAP;
  const height = PADDING * 2 + gridH + textH + (watermark ? WATERMARK_H : 0);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, width, height);

  if (glow) {
    ctx.save();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 6;
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 24;
    roundedRectPath(ctx, 14, 14, width - 28, height - 28, 28);
    ctx.stroke();
    ctx.restore();
  }

  const native = supportsCtxFilter();
  const images = await Promise.all(shots.slice(0, def.count).map(loadImage));
  images.forEach((img, i) => {
    const x = PADDING + (i % def.cols) * (def.slotW + GAP);
    const y = PADDING + Math.floor(i / def.cols) * (def.slotH + GAP);
    ctx.save();
    roundedRectPath(ctx, x, y, def.slotW, def.slotH, RADIUS);
    ctx.clip();
    drawFiltered(ctx, img, x, y, def.slotW, def.slotH, filter, native);
    ctx.restore();
  });

  const textColor = isLight(frameColor) ? NAVY : '#FFFFFF';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = PADDING + gridH + 16;
  const maxW = width - PADDING * 2;
  if (mainText) {
    drawFittedText(ctx, mainText, width / 2, y + 36, 56, 800, maxW, fonts.heading);
    y += 72;
  }
  if (subText) {
    drawFittedText(ctx, subText, width / 2, y + 26, 34, 400, maxW, fonts.body);
  }

  if (watermark) await drawWatermark(ctx, width, height, textColor);

  drawStickers(ctx, stickers, width, height, textColor);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))), type, 0.92);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestampName(ext: 'png' | 'jpg'): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `kameramera-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

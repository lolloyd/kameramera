export const PAPERS = [
  { id: '4x6', label: '4×6 in', w: 4, h: 6 },
  { id: '5x7', label: '5×7 in', w: 5, h: 7 },
  { id: '6x8', label: '6×8 in', w: 6, h: 8 },
  { id: 'a4', label: 'A4', w: 8.27, h: 11.69 },
  { id: 'a5', label: 'A5', w: 5.83, h: 8.27 },
  { id: 'letter', label: 'Letter', w: 8.5, h: 11 },
  { id: 'strip2', label: '2 strips on 4×6', w: 4, h: 6 },
] as const;

export type PaperId = (typeof PAPERS)[number]['id'];
export type PrintFit = 'contain' | 'cover';

export interface PrintOptions {
  paper: PaperId;
  copies: number;
  fit: PrintFit;
}

function loadSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not load the image to print.'));
    img.src = url;
  });
}

/** Prints the image through a hidden iframe, one sheet per copy (or two strips per sheet). */
export async function printBlob(blob: Blob, { paper, copies, fit }: PrintOptions): Promise<void> {
  const def = PAPERS.find((p) => p.id === paper) ?? PAPERS[0];
  const url = URL.createObjectURL(blob);
  const { w, h } = await loadSize(url);

  const strip = paper === 'strip2';
  const landscape = !strip && w > h;
  const pw = landscape ? def.h : def.w;
  const ph = landscape ? def.w : def.h;

  const count = Math.max(1, Math.min(50, Math.floor(copies)));
  // strip2 fills both halves of every sheet, so copies counts sheets.
  const cells = () =>
    Array.from({ length: strip ? 2 : 1 }, () => `<div class="cell"><img src="${url}" alt=""></div>`).join('');
  const sheets = Array.from({ length: count }, () => `<div class="sheet">${cells()}</div>`).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Kameramera</title><style>
    @page { size: ${pw}in ${ph}in; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .sheet { width: ${pw}in; height: ${ph - 0.01}in; display: flex; overflow: hidden; break-after: page; page-break-after: always; }
    .sheet:last-child { break-after: auto; page-break-after: auto; }
    .cell { flex: 1; height: 100%; display: flex; }
    img { width: 100%; height: 100%; object-fit: ${fit}; }
  </style></head><body>${sheets}</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  const cleanup = () => {
    iframe.remove();
    URL.revokeObjectURL(url);
  };

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
  });

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    cleanup();
    throw new Error('Could not open the print preview.');
  }
  await Promise.all(Array.from(doc.images).map((img) => img.decode().catch(() => {})));

  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 120_000);
  win.focus();
  win.print();
}

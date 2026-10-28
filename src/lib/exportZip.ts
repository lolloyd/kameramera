import { Zip, ZipPassThrough, zipSync } from 'fflate';
import type { EventRecord } from './events';
import { downloadBlob, timestampName } from './compose';
import { getPhoto, listPhotoIds, type GalleryItem } from './storage';

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const pad = (n: number) => String(n).padStart(3, '0');

/** Fallback zips are built in memory, so each part is kept well below browser limits. */
const PART_LIMIT_BYTES = 400 * 1024 * 1024;

export interface ExportResult {
  photos: number;
  originals: number;
  parts: number;
  cancelled?: boolean;
}

export type ExportProgress = (done: number, total: number) => void;

// File System Access API (Chrome / Edge desktop); not yet in TypeScript's DOM types.
type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

const getSavePicker = (): SaveFilePicker | undefined =>
  (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

/** The files that make up one photo inside the event ZIP. */
async function photoEntries(item: GalleryItem, index: number, base: string) {
  const name = `${base}-${pad(index + 1)}`;
  const entries: [string, Blob][] = [[`${name}.png`, item.blob]];
  (item.shots ?? []).forEach((shot, s) => entries.push([`originals/${name}/${name}-${s + 1}.jpg`, shot]));
  return entries;
}

/** Writes the ZIP straight to a file on disk; only one photo is held in memory at a time. */
async function streamToDisk(
  handle: FileSystemFileHandle,
  ids: number[],
  base: string,
  onProgress?: ExportProgress,
): Promise<ExportResult> {
  const out = await handle.createWritable();
  let writing: Promise<void> = Promise.resolve();
  let failure: unknown = null;

  const zip = new Zip((err, chunk) => {
    if (err) failure = err;
    else writing = writing.then(() => out.write(chunk as Uint8Array<ArrayBuffer>));
  });

  let photos = 0;
  let originals = 0;
  try {
    for (let i = 0; i < ids.length; i++) {
      const item = await getPhoto(ids[i]);
      if (!item) continue;
      for (const [path, blob] of await photoEntries(item, photos, base)) {
        const entry = new ZipPassThrough(path);
        zip.add(entry);
        entry.push(await bytes(blob), true);
        if (path.startsWith('originals/')) originals++;
      }
      photos++;
      // Wait for the disk to catch up before reading the next photo.
      await writing;
      if (failure) throw failure;
      onProgress?.(i + 1, ids.length);
    }
    zip.end();
    await writing;
    if (failure) throw failure;
    await out.close();
  } catch (e) {
    await out.abort().catch(() => {});
    throw e;
  }
  return { photos, originals, parts: 1 };
}

/** Builds several smaller ZIPs in memory and downloads them one after another. */
async function downloadInParts(ids: number[], base: string, date: string, onProgress?: ExportProgress): Promise<ExportResult> {
  let files: Record<string, Uint8Array> = {};
  let size = 0;
  let parts = 0;
  let photos = 0;
  let originals = 0;
  const pending: Blob[] = [];

  const flush = () => {
    if (!Object.keys(files).length) return;
    pending.push(new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' }));
    files = {};
    size = 0;
  };

  for (let i = 0; i < ids.length; i++) {
    const item = await getPhoto(ids[i]);
    if (!item) continue;
    const entries = await photoEntries(item, photos, base);
    const photoSize = entries.reduce((n, [, b]) => n + b.size, 0);
    // Keep a photo and its originals in the same part.
    if (size > 0 && size + photoSize > PART_LIMIT_BYTES) flush();
    for (const [path, blob] of entries) {
      files[path] = await bytes(blob);
      if (path.startsWith('originals/')) originals++;
    }
    size += photoSize;
    photos++;
    onProgress?.(i + 1, ids.length);
  }
  flush();

  parts = pending.length;
  for (let p = 0; p < parts; p++) {
    const suffix = parts > 1 ? `-part${p + 1}-of-${parts}` : '';
    downloadBlob(pending[p], `${base}-${date}${suffix}.zip`);
    // Browsers drop back-to-back downloads that fire in the same tick.
    if (p < parts - 1) await new Promise((r) => setTimeout(r, 800));
  }
  return { photos, originals, parts };
}

/**
 * Exports finished photos plus an originals/ folder per photo.
 * Streams to a chosen file where supported; otherwise splits into ZIPs of about 400 MB.
 * Call directly from a click handler so the save dialog is allowed to open.
 */
export async function exportEventZip(event: EventRecord, onProgress?: ExportProgress): Promise<ExportResult> {
  const base = slug(event.name);
  const filename = `${base}-${event.date}.zip`;
  if (event.id === undefined) return { photos: 0, originals: 0, parts: 0 };
  // A quick IndexedDB read keeps us well inside the click's user-activation window.
  const ids = await listPhotoIds(event.id);
  if (!ids.length) return { photos: 0, originals: 0, parts: 0 };

  let handle: FileSystemFileHandle | undefined;
  const picker = getSavePicker();
  if (picker) {
    try {
      handle = await picker({ suggestedName: filename, types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }] });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { photos: 0, originals: 0, parts: 0, cancelled: true };
      handle = undefined;
    }
  }

  return handle ? streamToDisk(handle, ids, base, onProgress) : downloadInParts(ids, base, event.date, onProgress);
}

/** One photo's original shots as a ZIP. Returns the number of shots. */
export async function exportOriginals(item: GalleryItem): Promise<number> {
  const shots = item.shots ?? [];
  if (!shots.length) return 0;
  const files: Record<string, Uint8Array> = {};
  for (const [i, shot] of shots.entries()) files[`photo-${i + 1}.jpg`] = await bytes(shot);
  const zipped = zipSync(files, { level: 0 });
  downloadBlob(
    new Blob([zipped as BlobPart], { type: 'application/zip' }),
    timestampName('png').replace('kameramera-', 'kameramera-originals-').replace('.png', '.zip'),
  );
  return shots.length;
}

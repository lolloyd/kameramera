import { zipSync } from 'fflate';
import type { EventRecord } from './events';
import { downloadBlob, timestampName } from './compose';
import { listPhotos, type GalleryItem } from './storage';

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';

const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

const pad = (n: number) => String(n).padStart(3, '0');

function saveZip(files: Record<string, Uint8Array>, filename: string) {
  const zipped = zipSync(files, { level: 0 });
  downloadBlob(new Blob([zipped as BlobPart], { type: 'application/zip' }), filename);
}

/** Final images at the top level; each photo's original shots in originals/<name>/. */
export async function exportEventZip(event: EventRecord): Promise<{ photos: number; originals: number }> {
  if (event.id === undefined) return { photos: 0, originals: 0 };
  const photos = (await listPhotos(event.id)).reverse();
  if (!photos.length) return { photos: 0, originals: 0 };

  const base = slug(event.name);
  const files: Record<string, Uint8Array> = {};
  let originals = 0;
  for (let i = 0; i < photos.length; i++) {
    const name = `${base}-${pad(i + 1)}`;
    files[`${name}.png`] = await bytes(photos[i].blob);
    for (const [s, shot] of (photos[i].shots ?? []).entries()) {
      files[`originals/${name}/${name}-${s + 1}.jpg`] = await bytes(shot);
      originals++;
    }
  }
  saveZip(files, `${base}-${event.date}.zip`);
  return { photos: photos.length, originals };
}

/** One photo's original shots as a ZIP. Returns the number of shots. */
export async function exportOriginals(item: GalleryItem): Promise<number> {
  const shots = item.shots ?? [];
  if (!shots.length) return 0;
  const files: Record<string, Uint8Array> = {};
  for (const [i, shot] of shots.entries()) files[`photo-${i + 1}.jpg`] = await bytes(shot);
  saveZip(files, timestampName('png').replace('kameramera-', 'kameramera-originals-').replace('.png', '.zip'));
  return shots.length;
}

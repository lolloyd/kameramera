import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EventRecord } from './events';
import type { FilterId } from './filters';
import type { LayoutId } from './layouts';
import type { Sticker } from './stickers';

export interface GalleryItem {
  id?: number;
  createdAt: number;
  blob: Blob;
  thumb: Blob;
  eventId?: number;
  printCount?: number;
  /** Full-size individual shots as captured, before layout, filter or frame. */
  shots?: Blob[];
}

/** The session currently in the booth, written after every shot and edit so a restart can resume it. */
export interface SessionDraft {
  shots: (Blob | null)[];
  screen: 'start' | 'capture' | 'review' | 'result';
  mode: 'single' | 'strip' | 'template';
  layout: LayoutId;
  filter: FilterId;
  frameColor: string;
  glow: boolean;
  caption: string;
  showDate: boolean;
  showEventInfo: boolean;
  watermark: boolean;
  stickers: Sticker[];
  savedPhotoId: number | null;
  updatedAt: number;
}

const DRAFT_KEY = 'current';

interface Schema extends DBSchema {
  photos: { key: number; value: GalleryItem; indexes: { 'by-date': number; 'by-event': number } };
  events: { key: number; value: EventRecord };
  drafts: { key: string; value: SessionDraft };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function getDb() {
  dbPromise ??= openDB<Schema>('kameramera', 3, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const photos = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
        photos.createIndex('by-date', 'createdAt');
      }
      if (oldVersion < 2) {
        tx.objectStore('photos').createIndex('by-event', 'eventId');
        db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
      }
      if (oldVersion < 3) {
        db.createObjectStore('drafts');
      }
    },
    blocked() {
      // Another tab still has the old version open.
      console.warn('Kameramera: close other tabs of this app to finish upgrading storage.');
    },
  });
  return dbPromise;
}

export async function saveDraft(draft: SessionDraft): Promise<void> {
  const db = await getDb();
  await db.put('drafts', draft, DRAFT_KEY);
}

export async function loadDraft(): Promise<SessionDraft | undefined> {
  const db = await getDb();
  return db.get('drafts', DRAFT_KEY);
}

export async function clearDraft(): Promise<void> {
  const db = await getDb();
  await db.delete('drafts', DRAFT_KEY);
}

/** Asks the browser not to evict saved photos when disk space runs low. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

export async function isStoragePersistent(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

async function makeThumb(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('thumbnail failed'));
      i.src = url;
    });
    const scale = Math.min(1, 480 / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('thumbnail failed'))), 'image/jpeg', 0.8),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Adds a photo, or replaces the one with the given id (keeping its timestamp, print count and shots unless new shots are given). */
export async function savePhoto(blob: Blob, opts: { eventId?: number; id?: number; shots?: Blob[] } = {}): Promise<number> {
  const thumb = await makeThumb(blob);
  const db = await getDb();
  if (opts.id !== undefined) {
    const existing = await db.get('photos', opts.id);
    return db.put('photos', {
      id: opts.id,
      createdAt: existing?.createdAt ?? Date.now(),
      blob,
      thumb,
      eventId: opts.eventId,
      printCount: existing?.printCount,
      shots: opts.shots ?? existing?.shots,
    });
  }
  return db.add('photos', { createdAt: Date.now(), blob, thumb, eventId: opts.eventId, shots: opts.shots });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}

export type PhotoFilter = 'all' | 'none' | number;

export async function listPhotos(filter: PhotoFilter = 'all'): Promise<GalleryItem[]> {
  const db = await getDb();
  const all = (await db.getAllFromIndex('photos', 'by-date')).reverse();
  if (filter === 'all') return all;
  if (filter === 'none') return all.filter((p) => p.eventId === undefined);
  return all.filter((p) => p.eventId === filter);
}

export async function countPhotos(eventId: number): Promise<number> {
  const db = await getDb();
  return db.countFromIndex('photos', 'by-event', eventId);
}

export async function deletePhoto(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('photos', id);
}

/** Adds to the photo's print counter and returns the new total. */
export async function addPrints(id: number, copies: number): Promise<number> {
  const db = await getDb();
  const tx = db.transaction('photos', 'readwrite');
  const photo = await tx.store.get(id);
  if (!photo) {
    await tx.done;
    return 0;
  }
  const printCount = (photo.printCount ?? 0) + copies;
  await tx.store.put({ ...photo, printCount });
  await tx.done;
  return printCount;
}

export async function listEvents(): Promise<EventRecord[]> {
  const db = await getDb();
  return (await db.getAll('events')).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getEvent(id: number): Promise<EventRecord | undefined> {
  const db = await getDb();
  return db.get('events', id);
}

export async function saveEvent(event: EventRecord): Promise<EventRecord> {
  const db = await getDb();
  const id = event.id !== undefined ? await db.put('events', event) : await db.add('events', event);
  return { ...event, id };
}

/** Deletes the event and every photo saved to it. */
export async function deleteEvent(id: number): Promise<void> {
  const db = await getDb();
  const keys = await db.getAllKeysFromIndex('photos', 'by-event', id);
  const tx = db.transaction(['photos', 'events'], 'readwrite');
  await Promise.all([...keys.map((k) => tx.objectStore('photos').delete(k)), tx.objectStore('events').delete(id), tx.done]);
}

export function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
}

import type { PaperId } from './print';

export interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Template {
  blob: Blob;
  width: number;
  height: number;
  /** In template pixels, in shot order. */
  slots: Slot[];
  /** overlay: photos sit behind the PNG (transparent windows). background: photos sit on top. */
  mode: 'overlay' | 'background';
}

export interface EventRecord {
  id?: number;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  createdAt: number;
  template?: Template;
  paper: PaperId;
  copies: number;
}

const ACTIVE_KEY = 'kameramera.activeEvent';

export function getActiveEventId(): number | null {
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function setActiveEventId(id: number | null) {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, String(id));
  } catch {
    // Storage may be blocked; the active event just won't persist.
  }
}

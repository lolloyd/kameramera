import { create } from 'zustand';
import { setActiveEventId, type EventRecord } from '@/lib/events';
import type { FilterId } from '@/lib/filters';
import { layoutInfo, STRIP_LAYOUTS, type LayoutId } from '@/lib/layouts';
import type { PhotoFilter } from '@/lib/storage';
import type { Sticker } from '@/lib/stickers';

export type Screen = 'start' | 'capture' | 'review' | 'result';
export type Mode = 'single' | 'strip' | 'template';

export interface Settings {
  timer: number;
  delay: number;
  mirror: boolean;
  sound: boolean;
  watermark: boolean;
}

export interface BoothState {
  screen: Screen;
  mode: Mode;
  layout: LayoutId;
  shots: (string | null)[];
  retakeIndex: number | null;
  filter: FilterId;
  frameColor: string;
  glow: boolean;
  caption: string;
  showDate: boolean;
  showEventInfo: boolean;
  stickers: Sticker[];
  settings: Settings;
  activeEvent: EventRecord | null;
  /** Gallery record for the current session, so edits replace it instead of adding copies. */
  savedPhotoId: number | null;
  /** Increments whenever a brand-new session begins. */
  sessionId: number;
  galleryFilter: PhotoFilter;
  setMode: (mode: Mode) => void;
  setLayout: (layout: LayoutId) => void;
  setFilter: (filter: FilterId) => void;
  setFrameColor: (color: string) => void;
  setGlow: (glow: boolean) => void;
  setCaption: (caption: string) => void;
  setShowDate: (showDate: boolean) => void;
  setShowEventInfo: (show: boolean) => void;
  addSticker: (emoji: string) => string;
  updateSticker: (id: string, patch: Partial<Sticker>) => void;
  removeSticker: (id: string) => void;
  applyKamePreset: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setActiveEvent: (event: EventRecord | null) => void;
  setGalleryFilter: (filter: PhotoFilter) => void;
  setSavedPhotoId: (id: number | null) => void;
  goTo: (screen: Screen) => void;
  startSession: () => void;
  loadUpload: (dataUrl: string) => void;
  setShot: (index: number, data: string) => void;
  retakeShot: (index: number) => void;
  finishRetake: () => void;
  reset: () => void;
}

export const useBooth = create<BoothState>()((set, get) => ({
  screen: 'start',
  mode: 'strip',
  layout: 'strip4',
  shots: [],
  retakeIndex: null,
  filter: 'none',
  frameColor: '#0B1226',
  glow: false,
  caption: '',
  showDate: false,
  showEventInfo: true,
  stickers: [],
  settings: { timer: 3, delay: 2, mirror: true, sound: true, watermark: true },
  activeEvent: null,
  savedPhotoId: null,
  sessionId: 0,
  galleryFilter: 'all',

  setMode: (mode) =>
    set((s) => {
      if (mode === 'single') return { mode, layout: '1x1' };
      if (mode === 'template') return s.activeEvent?.template ? { mode, layout: 'custom' } : {};
      return { mode, layout: s.layout === '1x1' || s.layout === 'custom' ? 'strip4' : s.layout };
    }),
  setLayout: (layout) => set({ layout }),
  setFilter: (filter) => set({ filter }),
  setFrameColor: (frameColor) => set({ frameColor }),
  setGlow: (glow) => set({ glow }),
  setCaption: (caption) => set({ caption }),
  setShowDate: (showDate) => set({ showDate }),
  setShowEventInfo: (showEventInfo) => set({ showEventInfo }),
  addSticker: (emoji) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ stickers: [...s.stickers, { id, emoji, x: 0.5, y: 0.5, size: 0.12 }] }));
    return id;
  },
  updateSticker: (id, patch) =>
    set((s) => ({ stickers: s.stickers.map((st) => (st.id === id ? { ...st, ...patch } : st)) })),
  removeSticker: (id) => set((s) => ({ stickers: s.stickers.filter((st) => st.id !== id) })),
  applyKamePreset: () => set({ frameColor: '#0B1226', glow: true }),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  setActiveEvent: (event) => {
    setActiveEventId(event?.id ?? null);
    set((s) => {
      const hasTemplate = !!event?.template;
      const base = { activeEvent: event, galleryFilter: event?.id ?? ('all' as const) };
      if (hasTemplate) return { ...base, mode: 'template' as const, layout: 'custom' as const };
      if (s.layout === 'custom') return { ...base, mode: 'strip' as const, layout: STRIP_LAYOUTS[0] };
      return base;
    });
  },
  setGalleryFilter: (galleryFilter) => set({ galleryFilter }),
  setSavedPhotoId: (savedPhotoId) => set({ savedPhotoId }),
  goTo: (screen) => set({ screen }),

  startSession: () => {
    const { layout, activeEvent, screen, savedPhotoId, sessionId } = get();
    const { count } = layoutInfo(layout, activeEvent?.template);
    const fresh = screen === 'start';
    // "Retake all" from review keeps the record; a fresh start from the start screen does not.
    set({
      shots: Array<string | null>(count).fill(null),
      retakeIndex: null,
      stickers: [],
      screen: 'capture',
      savedPhotoId: fresh ? null : savedPhotoId,
      sessionId: fresh ? sessionId + 1 : sessionId,
    });
  },
  loadUpload: (dataUrl) =>
    set((s) => ({
      mode: 'single',
      layout: '1x1',
      shots: [dataUrl],
      retakeIndex: null,
      stickers: [],
      screen: 'result',
      savedPhotoId: null,
      sessionId: s.sessionId + 1,
    })),
  setShot: (index, data) =>
    set((s) => {
      const shots = [...s.shots];
      shots[index] = data;
      return { shots };
    }),
  retakeShot: (index) => set({ retakeIndex: index, screen: 'capture' }),
  finishRetake: () => set({ retakeIndex: null, screen: 'review' }),
  reset: () =>
    set((s) => ({
      screen: 'start',
      shots: [],
      retakeIndex: null,
      stickers: [],
      caption: '',
      showDate: false,
      glow: false,
      filter: 'none',
      savedPhotoId: null,
      sessionId: s.sessionId + 1,
    })),
}));

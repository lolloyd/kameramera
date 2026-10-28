'use client';

import { useEffect } from 'react';
import { isComplete, saveSessionPhoto } from '@/lib/session';
import { blobToDataUrl, clearDraft, dataUrlToBlob, loadDraft, requestPersistentStorage, saveDraft, type SessionDraft } from '@/lib/storage';
import { useBooth, type BoothState } from '@/store/booth';

/** Keeps the in-progress session on disk so a reload or crash never loses captured shots. */
export default function SessionKeeper() {
  useEffect(() => {
    let ready = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const blobs = new Map<string, Blob>();

    const toBlob = async (shot: string) => {
      let b = blobs.get(shot);
      if (!b) {
        b = await dataUrlToBlob(shot);
        blobs.set(shot, b);
      }
      return b;
    };

    const persist = async () => {
      const s = useBooth.getState();
      if (!s.shots.some(Boolean)) {
        blobs.clear();
        await clearDraft();
        return;
      }
      const shots = await Promise.all(s.shots.map((x) => (x ? toBlob(x) : null)));
      for (const key of blobs.keys()) if (!s.shots.includes(key)) blobs.delete(key);
      const draft: SessionDraft = {
        shots,
        screen: s.screen,
        mode: s.mode,
        layout: s.layout,
        filter: s.filter,
        frameColor: s.frameColor,
        glow: s.glow,
        caption: s.caption,
        showDate: s.showDate,
        showEventInfo: s.showEventInfo,
        watermark: s.settings.watermark,
        stickers: s.stickers,
        savedPhotoId: s.savedPhotoId,
        updatedAt: Date.now(),
      };
      await saveDraft(draft);
    };

    let writing: Promise<void> = Promise.resolve();
    const write = () => {
      writing = writing.then(persist).catch(() => {});
    };

    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(write, delay);
    };

    const restore = async () => {
      await requestPersistentStorage();
      const draft = await loadDraft();
      if (!draft || useBooth.getState().shots.some(Boolean)) return;
      const shots = await Promise.all(draft.shots.map((b) => (b ? blobToDataUrl(b) : null)));
      if (!shots.some(Boolean)) return;
      const complete = isComplete(shots);
      useBooth.setState((s) => ({
        shots,
        // Never resume mid-countdown; land on review (or the editor if it was finished).
        screen: complete && draft.screen === 'result' ? 'result' : 'review',
        retakeIndex: null,
        mode: draft.mode,
        layout: draft.layout,
        filter: draft.filter,
        frameColor: draft.frameColor,
        glow: draft.glow,
        caption: draft.caption,
        showDate: draft.showDate,
        showEventInfo: draft.showEventInfo,
        settings: { ...s.settings, watermark: draft.watermark },
        stickers: draft.stickers,
        savedPhotoId: draft.savedPhotoId,
      }));
      if (complete) void saveSessionPhoto().catch(() => {});
    };

    restore()
      .catch(() => {})
      .finally(() => {
        ready = true;
        schedule(0);
      });

    const unsubscribe = useBooth.subscribe((state: BoothState, prev: BoothState) => {
      if (!ready) return;
      // A new shot is the moment a photo could be lost, so write it immediately.
      schedule(state.shots !== prev.shots ? 0 : 400);
      if (state.screen === 'review' && prev.screen !== 'review' && isComplete(state.shots)) {
        void saveSessionPhoto().catch(() => {});
      }
    });

    const flush = () => {
      if (!ready) return;
      clearTimeout(timer);
      write();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);

    return () => {
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

  return null;
}

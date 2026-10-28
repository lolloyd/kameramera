import { useBooth, type BoothState } from '@/store/booth';
import { canvasToBlob, composeImage, type ComposeOptions } from './compose';
import { getActiveEventId, type EventRecord } from './events';
import { dataUrlToBlob, getEvent, savePhoto } from './storage';

type ComposeState = Pick<
  BoothState,
  'layout' | 'shots' | 'frameColor' | 'filter' | 'caption' | 'showDate' | 'showEventInfo' | 'glow' | 'settings'
>;

export function composeOptions(s: ComposeState, event: EventRecord | null | undefined): ComposeOptions {
  const showEvent = s.showEventInfo && event;
  return {
    layout: s.layout,
    shots: s.shots.filter((x): x is string => !!x),
    frameColor: s.frameColor,
    watermark: s.settings.watermark,
    filter: s.filter,
    caption: s.caption,
    showDate: s.showDate,
    glow: s.glow,
    template: event?.template,
    eventInfo: showEvent ? { name: event.name, date: event.date } : undefined,
  };
}

export const isComplete = (shots: (string | null)[]) => shots.length > 0 && shots.every(Boolean);

/** The active event, read from storage if the store hasn't loaded it yet (e.g. right after a restart). */
async function resolveEvent(s: BoothState): Promise<EventRecord | undefined> {
  if (s.activeEvent) return s.activeEvent;
  const id = getActiveEventId();
  return id === null ? undefined : getEvent(id).catch(() => undefined);
}

export async function buildSessionImage(type: 'image/png' | 'image/jpeg'): Promise<Blob> {
  const s = useBooth.getState();
  const event = await resolveEvent(s);
  return canvasToBlob(await composeImage({ ...composeOptions(s, event), stickers: s.stickers }), type);
}

let chain: Promise<void> = Promise.resolve();

/**
 * Saves the current session to the gallery (and its event), replacing the session's
 * existing record. Calls are queued so concurrent saves never create duplicates.
 */
export function saveSessionPhoto(): Promise<void> {
  const run = chain.then(async () => {
    const s = useBooth.getState();
    if (!isComplete(s.shots)) return;
    const event = await resolveEvent(s);
    const blob = await canvasToBlob(await composeImage({ ...composeOptions(s, event), stickers: s.stickers }), 'image/png');
    const originals = await Promise.all(s.shots.filter((x): x is string => !!x).map(dataUrlToBlob));
    const id = await savePhoto(blob, { eventId: event?.id, id: s.savedPhotoId ?? undefined, shots: originals });
    if (useBooth.getState().sessionId === s.sessionId) useBooth.getState().setSavedPhotoId(id);
  });
  chain = run.catch(() => {});
  return run;
}

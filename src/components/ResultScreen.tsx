'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { canvasToBlob, composeImage, downloadBlob, timestampName } from '@/lib/compose';
import { FRAME_COLORS } from '@/lib/palette';
import { buildSessionImage, composeOptions, saveSessionPhoto } from '@/lib/session';
import { shareImage } from '@/lib/share';
import { STICKER_EMOJIS } from '@/lib/stickers';
import { addPrints, isQuotaError } from '@/lib/storage';
import { useBooth } from '@/store/booth';
import { ChipGroup } from './controls';
import FilterPicker from './FilterPicker';
import PrintDialog from './PrintDialog';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const QUOTA_MESSAGE = 'Storage is full. Delete some photos from the gallery and try again.';

type Tab = 'filter' | 'frame' | 'text' | 'stickers';
const ALL_TABS: { value: Tab; label: string }[] = [
  { value: 'filter', label: 'Filter' },
  { value: 'frame', label: 'Frame' },
  { value: 'text', label: 'Text' },
  { value: 'stickers', label: 'Stickers' },
];
const TEMPLATE_TABS = ALL_TABS.filter((t) => t.value === 'filter' || t.value === 'stickers');

export default function ResultScreen() {
  const {
    layout, shots, frameColor, filter, caption, showDate, showEventInfo, glow, stickers, settings, activeEvent,
    setFrameColor, setFilter, setCaption, setShowDate, setShowEventInfo, setGlow, applyKamePreset,
    addSticker, updateSticker, removeSticker, updateSettings, goTo, reset,
  } = useBooth();

  const [tab, setTab] = useState<Tab>('filter');
  const [preview, setPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);
  const [autoSave, setAutoSave] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    useBooth.getState().savedPhotoId !== null ? 'saved' : 'idle',
  );
  const [printing, setPrinting] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);

  const isTemplate = layout === 'custom';
  const tabs = isTemplate ? TEMPLATE_TABS : ALL_TABS;
  const { watermark } = settings;
  const template = activeEvent?.template;
  const eventName = showEventInfo ? activeEvent?.name : undefined;
  const eventDate = activeEvent?.date;

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setFailed(false);

    const timer = setTimeout(() => {
      const s = useBooth.getState();
      composeImage(composeOptions(s, s.activeEvent))
        .then(async (canvas) => {
          const blob = await canvasToBlob(canvas, 'image/png');
          if (cancelled) return;
          url = URL.createObjectURL(blob);
          setDims({ w: canvas.width, h: canvas.height });
          setPreview(url);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [layout, shots, frameColor, watermark, filter, caption, showDate, glow, template, eventName, eventDate]);

  const build = buildSessionImage;

  // Every finished photo is auto-saved to the gallery (and the active event); edits replace the same record.
  const dirty = useRef(false);

  const saveNow = async () => {
    dirty.current = false;
    setAutoSave('saving');
    try {
      await saveSessionPhoto();
      setAutoSave('saved');
    } catch (e) {
      setAutoSave('error');
      setStatus(isQuotaError(e) ? QUOTA_MESSAGE : 'Could not save the photo. Your shots are kept and will be saved again on the next change.');
      throw e;
    }
  };
  const saveRef = useRef(saveNow);
  saveRef.current = saveNow;

  useEffect(() => {
    dirty.current = true;
    const timer = setTimeout(() => void saveRef.current().catch(() => {}), 1000);
    return () => clearTimeout(timer);
  }, [layout, shots, frameColor, watermark, filter, caption, showDate, glow, stickers, eventName, eventDate]);

  useEffect(
    () => () => {
      if (dirty.current) void saveSessionPhoto().catch(() => {});
    },
    [],
  );

  const run = async (task: () => Promise<void>, errorText: string) => {
    setWorking(true);
    setStatus('');
    try {
      await task();
    } catch (e) {
      setStatus(isQuotaError(e) ? QUOTA_MESSAGE : errorText);
    } finally {
      setWorking(false);
    }
  };

  const download = (type: 'image/png' | 'image/jpeg') =>
    run(async () => {
      await saveNow();
      downloadBlob(await build(type), timestampName(type === 'image/png' ? 'png' : 'jpg'));
    }, 'Could not export the image.');

  const share = () =>
    run(async () => {
      const result = await shareImage(await build('image/png'), timestampName('png'));
      if (result === 'copied') setStatus('Copied to clipboard.');
      else if (result === 'unsupported') setStatus("Sharing isn't supported on this browser. Use download instead.");
    }, 'Could not share the image.');

  const newSession = () =>
    run(async () => {
      await saveNow();
      reset();
    }, 'Could not save this photo, so the session was kept. Try again or free up storage.');

  const onPointerMove = (e: PointerEvent) => {
    const id = dragging.current;
    const wrap = wrapRef.current;
    if (!id || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    updateSticker(id, { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height) });
  };

  const onStickerKey = (e: KeyboardEvent, id: string, x: number, y: number) => {
    const step = 0.01;
    if (e.key === 'ArrowLeft') updateSticker(id, { x: clamp01(x - step) });
    else if (e.key === 'ArrowRight') updateSticker(id, { x: clamp01(x + step) });
    else if (e.key === 'ArrowUp') updateSticker(id, { y: clamp01(y - step) });
    else if (e.key === 'ArrowDown') updateSticker(id, { y: clamp01(y + step) });
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      removeSticker(id);
      setSelected(null);
    } else return;
    e.preventDefault();
  };

  const current = stickers.find((s) => s.id === selected);
  const activeTab = tabs.some((t) => t.value === tab) ? tab : 'filter';

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-6">
      <div className="space-y-3 lg:sticky lg:top-4">
        <div className="card flex min-h-48 items-center justify-center">
          {failed ? (
            <p role="alert">Could not build the image. Go back and try again.</p>
          ) : preview && dims ? (
            <div
              ref={wrapRef}
              className="relative mx-auto select-none [container-type:inline-size]"
              style={{ width: `min(100%, calc(80vh * ${dims.w / dims.h}))` }}
              onPointerMove={onPointerMove}
              onPointerUp={() => (dragging.current = null)}
              onPointerCancel={() => (dragging.current = null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Final photo" draggable={false} className="block h-auto w-full rounded-xl" />
              {stickers.map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Sticker ${s.emoji}. Use arrow keys to move, Delete to remove.`}
                  onPointerDown={(e) => {
                    setSelected(s.id);
                    setTab('stickers');
                    dragging.current = s.id;
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onFocus={() => setSelected(s.id)}
                  onKeyDown={(e) => onStickerKey(e, s.id, s.x, s.y)}
                  style={{
                    left: `${s.x * 100}%`,
                    top: `${s.y * 100}%`,
                    fontSize: `${s.size * 100}cqw`,
                    transform: 'translate(-50%, -50%)',
                    lineHeight: 1,
                    touchAction: 'none',
                  }}
                  className={`absolute cursor-grab rounded-lg outline-none active:cursor-grabbing ${
                    selected === s.id ? 'ring-2 ring-kame-cyan' : ''
                  }`}
                >
                  {s.emoji}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/70">Building your photo…</p>
          )}
        </div>

        <p role="status" aria-live="polite" className="min-h-6 text-center text-white/80">
          {autoSave === 'saving' && 'Saving…'}
          {autoSave === 'saved' && (activeEvent ? `Saved to ${activeEvent.name}. ` : 'Saved to gallery. ')}
          {status}
          {autoSave === 'saved' && (
            <>
              {' '}
              <Link href="/gallery/" className="text-kame-cyan underline">
                View gallery
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="space-y-4">
        <section className="card space-y-4">
          <ChipGroup label="Edit" options={tabs} value={activeTab} onChange={setTab} />

          {activeTab === 'filter' && <FilterPicker value={filter} onChange={setFilter} />}

          {activeTab === 'frame' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {FRAME_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.name}
                    aria-pressed={frameColor === c.value}
                    onClick={() => setFrameColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={`h-12 w-12 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kame-blue/60 ${
                      frameColor === c.value ? 'scale-110 border-kame-yellow' : 'border-white/30'
                    }`}
                  />
                ))}
                <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={applyKamePreset}>
                  Kame style
                </button>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>Cyan glow border</span>
                <input type="checkbox" checked={glow} onChange={(e) => setGlow(e.target.checked)} className="h-6 w-6 accent-kame-yellow" />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>Kameramera watermark</span>
                <input
                  type="checkbox"
                  checked={watermark}
                  onChange={(e) => updateSettings({ watermark: e.target.checked })}
                  className="h-6 w-6 accent-kame-yellow"
                />
              </label>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-4">
              <input
                type="text"
                value={caption}
                maxLength={40}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption"
                aria-label="Caption"
                className="w-full rounded-2xl border border-white/20 bg-navy-900/60 px-4 py-3 text-white placeholder:text-white/40 focus:border-kame-blue focus:outline-none focus:ring-4 focus:ring-kame-blue/40"
              />
              {activeEvent && (
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span>Event name and date</span>
                  <input type="checkbox" checked={showEventInfo} onChange={(e) => setShowEventInfo(e.target.checked)} className="h-6 w-6 accent-kame-yellow" />
                </label>
              )}
              {!(activeEvent && showEventInfo) && (
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span>Date stamp</span>
                  <input type="checkbox" checked={showDate} onChange={(e) => setShowDate(e.target.checked)} className="h-6 w-6 accent-kame-yellow" />
                </label>
              )}
            </div>
          )}

          {activeTab === 'stickers' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {STICKER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Add ${emoji} sticker`}
                    onClick={() => setSelected(addSticker(emoji))}
                    className="h-12 w-12 rounded-2xl bg-navy-900/50 text-2xl transition hover:bg-navy-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kame-blue/60 active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {current && (
                <div className="flex gap-3">
                  <button type="button" className="btn-secondary flex-1 py-2" onClick={() => updateSticker(current.id, { size: Math.max(0.04, current.size - 0.02) })}>
                    Smaller
                  </button>
                  <button type="button" className="btn-secondary flex-1 py-2" onClick={() => updateSticker(current.id, { size: Math.min(0.4, current.size + 0.02) })}>
                    Larger
                  </button>
                  <button
                    type="button"
                    className="btn flex-1 border border-rec bg-rec/10 py-2 text-rec hover:bg-rec/20"
                    onClick={() => {
                      removeSticker(current.id);
                      setSelected(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
              <p className="text-sm text-white/60">Tap a sticker to add it, then drag it on the photo.</p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-primary col-span-2 py-4 text-lg" disabled={!preview || working} onClick={() => setPrinting(true)}>
            Print
          </button>
          <button type="button" className="btn-primary" disabled={!preview || working} onClick={() => void download('image/png')}>
            Download PNG
          </button>
          <button type="button" className="btn-primary" disabled={!preview || working} onClick={() => void download('image/jpeg')}>
            Download JPG
          </button>
          <button type="button" className="btn-secondary" disabled={!preview || working} onClick={() => void share()}>
            Share
          </button>
          <button type="button" className="btn-secondary" onClick={() => goTo('review')}>
            Back to review
          </button>
          <button type="button" className="btn-secondary" disabled={working} onClick={() => void newSession()}>
            New session
          </button>
        </div>
      </div>

      {printing && (
        <PrintDialog
          getBlob={async () => {
            await saveNow();
            return build('image/png');
          }}
          defaultPaper={activeEvent?.paper}
          defaultCopies={activeEvent?.copies}
          onPrinted={async (copies) => {
            const id = useBooth.getState().savedPhotoId;
            if (id !== null) await addPrints(id, copies);
          }}
          onClose={() => setPrinting(false)}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { canvasToBlob, composeImage } from '@/lib/compose';
import type { Slot, Template } from '@/lib/events';
import { defaultSlot, detectSlots, placeholderShots, sortSlots } from '@/lib/template';

interface Props {
  value: Template;
  onChange: (t: Template) => void;
}

interface Drag {
  index: number;
  kind: 'move' | 'resize';
  sx: number;
  sy: number;
  orig: Slot;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export default function TemplateEditor({ value, onChange }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(value.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [value.blob]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const minSize = Math.max(20, Math.round(value.width * 0.03));
  const setSlots = (slots: Slot[]) => onChange({ ...value, slots });

  const detect = async () => {
    setMessage('Detecting…');
    const slots = await detectSlots(value.blob);
    setSelected(null);
    if (slots.length) {
      onChange({ ...value, slots, mode: 'overlay' });
      setMessage(`Found ${slots.length} photo area${slots.length === 1 ? '' : 's'}. Drag to adjust.`);
    } else {
      onChange({ ...value, slots: value.slots.length ? value.slots : [defaultSlot(value)], mode: 'background' });
      setMessage('No transparent areas found, so the PNG is used as a background. Position the photo areas yourself.');
    }
  };

  const addSlot = () => {
    const slot = defaultSlot(value);
    setSlots([...value.slots, slot]);
    setSelected(value.slots.length);
  };

  const removeSelected = () => {
    if (selected === null) return;
    setSlots(value.slots.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    const wrap = wrapRef.current;
    if (!d || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dx = ((e.clientX - d.sx) / rect.width) * value.width;
    const dy = ((e.clientY - d.sy) / rect.height) * value.height;
    const next: Slot = { ...d.orig };
    if (d.kind === 'move') {
      next.x = clamp(d.orig.x + dx, 0, value.width - d.orig.w);
      next.y = clamp(d.orig.y + dy, 0, value.height - d.orig.h);
    } else {
      next.w = clamp(d.orig.w + dx, minSize, value.width - d.orig.x);
      next.h = clamp(d.orig.h + dy, minSize, value.height - d.orig.y);
    }
    const rounded = { x: Math.round(next.x), y: Math.round(next.y), w: Math.round(next.w), h: Math.round(next.h) };
    setSlots(value.slots.map((s, i) => (i === d.index ? rounded : s)));
  };

  const startDrag = (e: PointerEvent, index: number, kind: Drag['kind']) => {
    e.stopPropagation();
    setSelected(index);
    drag.current = { index, kind, sx: e.clientX, sy: e.clientY, orig: value.slots[index] };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onKey = (e: KeyboardEvent, index: number) => {
    const s = value.slots[index];
    const step = Math.round(value.width * 0.005) || 1;
    const patch: Partial<Slot> =
      e.key === 'ArrowLeft' ? { x: clamp(s.x - step, 0, value.width - s.w) }
      : e.key === 'ArrowRight' ? { x: clamp(s.x + step, 0, value.width - s.w) }
      : e.key === 'ArrowUp' ? { y: clamp(s.y - step, 0, value.height - s.h) }
      : e.key === 'ArrowDown' ? { y: clamp(s.y + step, 0, value.height - s.h) }
      : {};
    if (!Object.keys(patch).length) return;
    e.preventDefault();
    setSlots(value.slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const preview = async () => {
    setMessage('Building preview…');
    try {
      const canvas = await composeImage({
        layout: 'custom',
        shots: placeholderShots(value.slots.length),
        frameColor: '#FFFFFF',
        watermark: false,
        template: value,
      });
      const blob = await canvasToBlob(canvas, 'image/png');
      setPreviewUrl(URL.createObjectURL(blob));
      setMessage('');
    } catch {
      setMessage('Could not build the preview.');
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerDown={() => setSelected(null)}
        className="relative mx-auto select-none overflow-hidden rounded-xl border border-white/20"
        style={{
          aspectRatio: `${value.width} / ${value.height}`,
          width: `min(100%, calc(75vh * ${value.width / value.height}))`,
          backgroundImage: 'conic-gradient(#3a3f4d 25%, #272b36 0 50%, #3a3f4d 0 75%, #272b36 0)',
          backgroundSize: '20px 20px',
        }}
      >
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Template" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
        )}
        {value.slots.map((s, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            aria-label={`Photo area ${i + 1}. Arrow keys move it.`}
            onPointerDown={(e) => startDrag(e, i, 'move')}
            onKeyDown={(e) => onKey(e, i)}
            onFocus={() => setSelected(i)}
            style={{
              left: `${(s.x / value.width) * 100}%`,
              top: `${(s.y / value.height) * 100}%`,
              width: `${(s.w / value.width) * 100}%`,
              height: `${(s.h / value.height) * 100}%`,
              touchAction: 'none',
            }}
            className={`absolute cursor-move border-2 bg-kame-cyan/25 outline-none ${
              selected === i ? 'border-kame-yellow' : 'border-kame-cyan'
            }`}
          >
            <span className="absolute left-1 top-1 rounded bg-navy-900/80 px-2 text-sm font-bold">{i + 1}</span>
            <span
              onPointerDown={(e) => startDrag(e, i, 'resize')}
              style={{ touchAction: 'none' }}
              className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize bg-kame-yellow"
              aria-hidden
            />
          </div>
        ))}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-white/70">How the PNG is used</legend>
        <label className="flex items-start gap-3">
          <input type="radio" name="mode" checked={value.mode === 'overlay'} onChange={() => onChange({ ...value, mode: 'overlay' })} className="mt-1 h-5 w-5 accent-kame-yellow" />
          <span>
            Frame on top
            <span className="block text-sm text-white/60">Photos go behind the PNG and show through its transparent areas.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="radio" name="mode" checked={value.mode === 'background'} onChange={() => onChange({ ...value, mode: 'background' })} className="mt-1 h-5 w-5 accent-kame-yellow" />
          <span>
            Background
            <span className="block text-sm text-white/60">Photos are placed on top of the PNG.</span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => void detect()}>
          Auto-detect areas
        </button>
        <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={addSlot}>
          Add photo area
        </button>
        <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => setSlots(sortSlots(value.slots))}>
          Number by position
        </button>
        <button type="button" className="btn-secondary px-4 py-2 text-sm" disabled={selected === null} onClick={removeSelected}>
          Remove selected
        </button>
        <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={!value.slots.length} onClick={() => void preview()}>
          Preview
        </button>
      </div>

      <p className="text-sm text-white/70" role="status" aria-live="polite">
        {message || `${value.slots.length} photo area${value.slots.length === 1 ? '' : 's'}. Numbers show the order guests are photographed.`}
      </p>

      {previewUrl && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Layout preview with sample photos" className="mx-auto max-h-[60vh] max-w-full rounded-xl" />
          <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => setPreviewUrl(null)}>
            Close preview
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { EventRecord, Template } from '@/lib/events';
import { PAPERS, type PaperId } from '@/lib/print';
import { saveEvent } from '@/lib/storage';
import { detectSlots, readTemplateFile } from '@/lib/template';
import TemplateEditor from './TemplateEditor';
import { ChipGroup, Stepper } from './controls';

interface Props {
  event: EventRecord | null;
  onSaved: (event: EventRecord) => void;
  onCancel: () => void;
}

const field =
  'w-full rounded-2xl border border-white/20 bg-navy-900/60 px-4 py-3 text-white placeholder:text-white/40 focus:border-kame-blue focus:outline-none focus:ring-4 focus:ring-kame-blue/40';

const today = () => new Date().toISOString().slice(0, 10);
const paperOptions = PAPERS.map((p) => ({ value: p.id, label: p.label }));

export default function EventEditor({ event, onSaved, onCancel }: Props) {
  const [name, setName] = useState(event?.name ?? '');
  const [date, setDate] = useState(event?.date ?? today());
  const [paper, setPaper] = useState<PaperId>(event?.paper ?? '4x6');
  const [copies, setCopies] = useState(event?.copies ?? 1);
  const [template, setTemplate] = useState<Template | undefined>(event?.template);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setNote('');
    try {
      const { blob, width, height } = await readTemplateFile(file);
      const slots = await detectSlots(blob);
      const base = { blob, width, height };
      if (slots.length) {
        setTemplate({ ...base, slots, mode: 'overlay' });
        setNote(`Found ${slots.length} photo area${slots.length === 1 ? '' : 's'}. Adjust them below if needed.`);
      } else {
        setTemplate({
          ...base,
          slots: [{ x: Math.round(width * 0.25), y: Math.round(height * 0.25), w: Math.round(width * 0.5), h: Math.round(width * 0.375) }],
          mode: 'background',
        });
        setNote('No transparent areas found, so the PNG is used as a background. Position the photo areas below.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Give the event a name.');
      return;
    }
    if (template && template.slots.length === 0) {
      setError('Add at least one photo area to the template.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await saveEvent({
        ...(event ?? { createdAt: Date.now() }),
        name: name.trim(),
        date,
        paper,
        copies,
        template,
      });
      onSaved(saved);
    } catch {
      setError('Could not save the event. Storage may be full.');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{event ? 'Edit event' : 'New event'}</h1>

      <div className="grid gap-5 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start">
      <div className="space-y-5">
      <section className="card space-y-3">
        <label className="block space-y-1">
          <span className="text-sm text-white/70">Event name</span>
          <input type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Maria and Jon's Wedding" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-white/70">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold text-kame-cyan">Printing defaults</h2>
        <div className="space-y-2">
          <span className="text-sm text-white/70">Paper</span>
          <ChipGroup label="Paper" options={paperOptions} value={paper} onChange={setPaper} />
        </div>
        <div className="space-y-2">
          <span className="text-sm text-white/70">Copies per photo</span>
          <Stepper label="copies" value={copies} min={1} max={50} onChange={setCopies} />
        </div>
      </section>
      </div>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold text-kame-cyan">Layout template</h2>
        <p className="text-sm text-white/70">
          Upload a PNG sample of the layout. Transparent areas are detected as photo areas, and you can adjust or add them.
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="btn-secondary cursor-pointer px-4 py-2 text-sm focus-within:ring-4 focus-within:ring-kame-blue/60">
            {template ? 'Replace PNG' : 'Upload PNG'}
            <input
              type="file"
              accept="image/png,image/*"
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {template && (
            <button type="button" className="btn border border-rec bg-rec/10 px-4 py-2 text-sm text-rec" onClick={() => setTemplate(undefined)}>
              Remove template
            </button>
          )}
        </div>
        {note && <p className="text-sm text-kame-cyan">{note}</p>}
        {template ? (
          <TemplateEditor value={template} onChange={setTemplate} />
        ) : (
          <p className="text-sm text-white/60">No template. The booth will use its built-in layouts.</p>
        )}
      </section>
      </div>

      {error && (
        <p role="alert" className="text-rec">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn-primary flex-1" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save event'}
        </button>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { EventRecord } from '@/lib/events';
import { exportEventZip } from '@/lib/exportZip';
import { PAPERS } from '@/lib/print';
import { countPhotos, deleteEvent, isStoragePersistent, listEvents, requestPersistentStorage } from '@/lib/storage';
import { useBooth } from '@/store/booth';
import EventEditor from './EventEditor';

type View = { kind: 'list' } | { kind: 'edit'; event: EventRecord | null };

function TemplateThumb({ event }: { event: EventRecord }) {
  const [url, setUrl] = useState<string | null>(null);
  const blob = event.template?.blob;
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return null;
  return (
    <div
      className="h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-white/20"
      style={{ backgroundImage: 'conic-gradient(#3a3f4d 25%, #272b36 0 50%, #3a3f4d 0 75%, #272b36 0)', backgroundSize: '12px 12px' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Template preview" className="h-full w-full object-contain" />
    </div>
  );
}

export default function EventsManager() {
  const activeEvent = useBooth((s) => s.activeEvent);
  const setActiveEvent = useBooth((s) => s.setActiveEvent);
  const setGalleryFilter = useBooth((s) => s.setGalleryFilter);

  const [view, setView] = useState<View>({ kind: 'list' });
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [error, setError] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [persistent, setPersistent] = useState(true);

  useEffect(() => {
    void isStoragePersistent().then(setPersistent);
  }, []);

  const load = useCallback(async () => {
    try {
      const list = await listEvents();
      const entries = await Promise.all(list.map(async (e) => [e.id as number, await countPhotos(e.id as number)] as const));
      setEvents(list);
      setCounts(Object.fromEntries(entries));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaved = async (saved: EventRecord) => {
    const isNew = view.kind === 'edit' && view.event === null;
    if (isNew || activeEvent?.id === saved.id) setActiveEvent(saved);
    setView({ kind: 'list' });
    await load();
  };

  const remove = async (event: EventRecord) => {
    if (event.id === undefined) return;
    await deleteEvent(event.id);
    if (activeEvent?.id === event.id) setActiveEvent(null);
    setConfirmId(null);
    await load();
  };

  const [exporting, setExporting] = useState(false);

  const exportZip = async (event: EventRecord) => {
    setExporting(true);
    setStatus('Preparing ZIP…');
    try {
      const result = await exportEventZip(event, (done, total) => setStatus(`Exporting photo ${done} of ${total}…`));
      if (result.cancelled) {
        setStatus('Export cancelled.');
      } else if (!result.photos) {
        setStatus('This event has no photos yet.');
      } else {
        const what = `${result.photos} photo${result.photos === 1 ? '' : 's'} and ${result.originals} original picture${result.originals === 1 ? '' : 's'}`;
        setStatus(
          result.parts > 1
            ? `Exported ${what} in ${result.parts} ZIP files. If only one downloaded, allow multiple downloads for this site and try again.`
            : `Exported ${what}.`,
        );
      }
    } catch (e) {
      setStatus(
        e instanceof DOMException && e.name === 'QuotaExceededError'
          ? 'Not enough disk space for the ZIP. Free up space or choose another drive.'
          : 'Could not create the ZIP. Try again, or use Chrome or Edge on a computer for large events.',
      );
    } finally {
      setExporting(false);
    }
  };

  if (view.kind === 'edit') {
    return <EventEditor event={view.event} onSaved={(e) => void onSaved(e)} onCancel={() => setView({ kind: 'list' })} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Events</h1>
        <button type="button" className="btn-primary px-5 py-2" onClick={() => setView({ kind: 'edit', event: null })}>
          New event
        </button>
      </div>

      {!persistent && (
        <div role="alert" className="card flex flex-wrap items-center justify-between gap-3 border-kame-yellow">
          <p className="text-sm">
            This browser may delete saved photos if the disk gets low on space. Install Kameramera as an app (browser menu → Install) or allow
            storage, and export each event ZIP after the event.
          </p>
          <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => void requestPersistentStorage().then(setPersistent)}>
            Protect storage
          </button>
        </div>
      )}

      {activeEvent && (
        <div className="card flex items-center justify-between gap-3">
          <p>
            Active: <span className="font-bold text-kame-yellow">{activeEvent.name}</span>
          </p>
          <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => setActiveEvent(null)}>
            Stop using event
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="card text-center">
          Could not open events. Your browser may be blocking storage.
        </p>
      ) : events === null ? (
        <p className="text-white/70">Loading…</p>
      ) : events.length === 0 ? (
        <div className="card space-y-3 py-8 text-center">
          <p className="text-lg">No events yet.</p>
          <p className="text-white/70">Create an event to collect its photos, set a layout template, and print.</p>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {events.map((event) => {
            const isActive = activeEvent?.id === event.id;
            const paper = PAPERS.find((p) => p.id === event.paper)?.label ?? event.paper;
            return (
              <li key={event.id} className={`card space-y-3 ${isActive ? 'border-kame-yellow' : ''}`}>
                <div className="flex gap-3">
                  <TemplateThumb event={event} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold">
                      {event.name}
                      {isActive && <span className="ml-2 rounded-full bg-kame-yellow px-2 py-0.5 text-xs text-navy-900">Active</span>}
                    </h2>
                    <p className="text-sm text-white/70">
                      {event.date} · {counts[event.id as number] ?? 0} photo{counts[event.id as number] === 1 ? '' : 's'}
                    </p>
                    <p className="text-sm text-white/60">
                      {event.template ? `Template: ${event.template.slots.length} photo area${event.template.slots.length === 1 ? '' : 's'}` : 'No template'} · Print {event.copies}× {paper}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isActive && (
                    <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={() => setActiveEvent(event)}>
                      Use this event
                    </button>
                  )}
                  <Link href="/gallery/" onClick={() => setGalleryFilter(event.id as number)} className="btn-secondary px-4 py-2 text-sm">
                    View photos
                  </Link>
                  <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => setView({ kind: 'edit', event })}>
                    Edit
                  </button>
                  <button type="button" className="btn-secondary px-4 py-2 text-sm" disabled={exporting} onClick={() => void exportZip(event)}>
                    Export ZIP
                  </button>
                  {confirmId === event.id ? (
                    <button type="button" className="btn border border-rec bg-rec px-4 py-2 text-sm text-navy-900" onClick={() => void remove(event)}>
                      Confirm: delete event and its photos
                    </button>
                  ) : (
                    <button type="button" className="btn border border-rec bg-rec/10 px-4 py-2 text-sm text-rec" onClick={() => setConfirmId(event.id as number)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p role="status" aria-live="polite" className="min-h-6 text-center text-white/80">
        {status}
      </p>
    </div>
  );
}

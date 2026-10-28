'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { downloadBlob, timestampName } from '@/lib/compose';
import type { EventRecord } from '@/lib/events';
import { exportOriginals } from '@/lib/exportZip';
import { shareImage } from '@/lib/share';
import { addPrints, deletePhoto, listEvents, listPhotos, type GalleryItem, type PhotoFilter } from '@/lib/storage';
import { useBooth } from '@/store/booth';
import { ChipGroup } from './controls';
import Logo from './Logo';
import PrintDialog from './PrintDialog';

interface Entry {
  item: GalleryItem;
  thumbUrl: string;
}

export default function Gallery() {
  const filter = useBooth((s) => s.galleryFilter);
  const setFilter = useBooth((s) => s.setGalleryFilter);
  const activeEvent = useBooth((s) => s.activeEvent);

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [shotUrls, setShotUrls] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    listEvents()
      .then(setEvents)
      .catch(() => {});
  }, []);

  const load = useCallback(async (f: PhotoFilter) => {
    try {
      const items = await listPhotos(f);
      setEntries((prev) => {
        prev?.forEach((e) => URL.revokeObjectURL(e.thumbUrl));
        return items.map((item) => ({ item, thumbUrl: URL.createObjectURL(item.thumb) }));
      });
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  const open = entries?.find((e) => e.item.id === openId) ?? null;
  const openEvent = events.find((e) => e.id === open?.item.eventId) ?? (open?.item.eventId === activeEvent?.id ? activeEvent : null);

  useEffect(() => {
    if (!open) {
      setFullUrl(null);
      setShotUrls([]);
      return;
    }
    const url = URL.createObjectURL(open.item.blob);
    const shots = (open.item.shots ?? []).map((b) => URL.createObjectURL(b));
    setFullUrl(url);
    setShotUrls(shots);
    return () => {
      URL.revokeObjectURL(url);
      shots.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !printing) setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [printing]);

  const close = () => {
    setOpenId(null);
    setConfirming(false);
    setStatus('');
  };

  const remove = async () => {
    if (!open?.item.id) return;
    await deletePhoto(open.item.id);
    close();
    await load(filter);
  };

  const share = async () => {
    if (!open) return;
    try {
      const r = await shareImage(open.item.blob, timestampName('png'));
      if (r === 'copied') setStatus('Copied to clipboard.');
      else if (r === 'unsupported') setStatus("Sharing isn't supported on this browser.");
    } catch {
      setStatus('Could not share the image.');
    }
  };

  const filterOptions = useMemo(
    () => [
      { value: 'all', label: 'All photos' },
      ...events.map((e) => ({ value: String(e.id), label: e.name })),
      { value: 'none', label: 'No event' },
    ],
    [events],
  );
  const onFilter = (v: string) => setFilter(v === 'all' || v === 'none' ? v : Number(v));
  const printed = open?.item.printCount ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Gallery</h1>
        <Link href="/" className="btn-secondary px-5 py-2">
          Back to booth
        </Link>
      </div>

      <ChipGroup label="Show photos from" options={filterOptions} value={String(filter)} onChange={onFilter} />

      {error ? (
        <p role="alert" className="card text-center">
          Could not open saved photos. Your browser may be blocking storage.
        </p>
      ) : entries === null ? (
        <p className="text-white/70">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="card mx-auto flex max-w-xl flex-col items-center gap-3 py-10 text-center">
          <Logo size={96} />
          <p className="text-lg">No photos yet. Time to fire a Kamehameha!</p>
          <Link href="/" className="btn-primary">
            Open the booth
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-white/60">
            {entries.length} photo{entries.length === 1 ? '' : 's'}
          </p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {entries.map(({ item, thumbUrl }) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(item.id ?? null)}
                  aria-label={`Open photo from ${new Date(item.createdAt).toLocaleString()}`}
                  className="relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-navy-700 transition hover:border-kame-cyan focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kame-blue/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbUrl} alt="" className="h-48 w-full object-contain sm:h-56" />
                  <span
                    aria-label={`Printed ${item.printCount ?? 0} ${item.printCount === 1 ? 'time' : 'times'}`}
                    className={`absolute right-2 top-2 min-w-8 rounded-full px-2 py-1 text-center text-sm font-bold shadow ${
                      item.printCount ? 'bg-kame-yellow text-navy-900' : 'bg-navy-900/80 text-white/70'
                    }`}
                  >
                    {item.printCount ?? 0}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {open && fullUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-navy-900/95 p-4 lg:flex-row lg:p-8"
        >
          <div className="flex min-w-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fullUrl} alt="Saved photo" className="max-h-[85vh] max-w-full rounded-xl" />
          </div>

          <aside className="flex w-full flex-col gap-4 lg:w-96 lg:shrink-0 lg:overflow-y-auto">
            <p className="text-lg font-semibold">
              Printed {printed} {printed === 1 ? 'time' : 'times'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="btn-primary col-span-2 py-4 text-lg" onClick={() => setPrinting(true)}>
                Print
              </button>
              <button type="button" className="btn-secondary" onClick={() => downloadBlob(open.item.blob, timestampName('png'))}>
                Download
              </button>
              <button type="button" className="btn-secondary" onClick={() => void share()}>
                Share
              </button>
              {confirming ? (
                <button type="button" className="btn border border-rec bg-rec text-navy-900" onClick={() => void remove()}>
                  Confirm delete
                </button>
              ) : (
                <button type="button" className="btn border border-rec bg-rec/10 text-rec" onClick={() => setConfirming(true)}>
                  Delete
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={close} autoFocus>
                Close
              </button>
            </div>

            <p role="status" aria-live="polite" className="min-h-6 text-white/80">
              {status}
            </p>

            {shotUrls.length > 0 && (
              <section aria-label="Original photos" className="card space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-kame-cyan">Original photos</h2>
                  {shotUrls.length > 1 && (
                    <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => void exportOriginals(open.item)}>
                      All (ZIP)
                    </button>
                  )}
                </div>
                <ul className="grid grid-cols-2 gap-3">
                  {shotUrls.map((u, i) => (
                    <li key={u} className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`Original ${i + 1}`} className="w-full rounded-lg" />
                      <a href={u} download={`kameramera-original-${i + 1}.jpg`} className="btn-secondary w-full px-3 py-1 text-sm">
                        Download {i + 1}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}

      {printing && open && (
        <PrintDialog
          getBlob={async () => open.item.blob}
          defaultPaper={openEvent?.paper}
          defaultCopies={openEvent?.copies}
          onPrinted={async (copies) => {
            const id = open.item.id;
            if (id === undefined) return;
            const printCount = await addPrints(id, copies);
            setEntries((prev) => prev?.map((e) => (e.item.id === id ? { ...e, item: { ...e.item, printCount } } : e)) ?? prev);
          }}
          onClose={() => setPrinting(false)}
        />
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { LAYOUTS, STRIP_LAYOUTS, type BuiltinLayoutId } from '@/lib/layouts';
import { fileToShot } from '@/lib/upload';
import { useBooth } from '@/store/booth';
import Logo from './Logo';

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 px-4 py-3 font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kame-blue/60 ${
        selected
          ? 'border-kame-yellow bg-kame-yellow/10 text-kame-yellow'
          : 'border-white/10 bg-navy-900/40 text-white hover:border-kame-cyan'
      }`}
    >
      {children}
    </button>
  );
}

function LayoutIcon({ id }: { id: BuiltinLayoutId | 'template' }) {
  const cell = 'rounded-[2px] bg-current';
  if (id === '1x1') return <div className={`h-7 w-9 ${cell}`} aria-hidden />;
  if (id === '2x2') {
    return (
      <div className="grid grid-cols-2 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-3 w-4 ${cell}`} />
        ))}
      </div>
    );
  }
  if (id === 'template') {
    return <div className="h-7 w-9 rounded-[3px] border-2 border-current" aria-hidden />;
  }
  return (
    <div className="flex flex-col gap-0.5" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`h-1.5 w-8 ${cell}`} />
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold text-kame-cyan">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-6 accent-kame-yellow"
      />
    </label>
  );
}

export default function StartScreen() {
  const { mode, layout, settings, activeEvent, setMode, setLayout, updateSettings, startSession, loadUpload } = useBooth();
  const [uploadError, setUploadError] = useState('');
  const template = activeEvent?.template;

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadError('');
    try {
      loadUpload(await fileToShot(file));
    } catch {
      setUploadError('Could not read that image. Try a JPG or PNG.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Logo size={140} />
        <p className="text-lg text-white/80">Strike a pose. Fire the camera.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <div className="card flex items-center justify-between gap-3 md:col-span-2 xl:col-span-3">
        {activeEvent ? (
          <p>
            <span className="text-white/70">Event: </span>
            <span className="font-bold text-kame-yellow">{activeEvent.name}</span>
            <span className="block text-sm text-white/60">Every finished photo is saved to this event.</span>
          </p>
        ) : (
          <p className="text-white/80">No event selected. Photos are not saved automatically.</p>
        )}
        <Link href="/events/" className="btn-secondary shrink-0 px-4 py-2 text-sm">
          {activeEvent ? 'Change' : 'Set up'}
        </Link>
      </div>

      <Section title="Mode">
        <div className="flex gap-3">
          {template && (
            <Choice selected={mode === 'template'} onClick={() => setMode('template')}>
              <LayoutIcon id="template" />
              Event template
            </Choice>
          )}
          <Choice selected={mode === 'single'} onClick={() => setMode('single')}>
            <LayoutIcon id="1x1" />
            Single shot
          </Choice>
          <Choice selected={mode === 'strip'} onClick={() => setMode('strip')}>
            <LayoutIcon id="strip4" />
            Photo strip
          </Choice>
        </div>
        {mode === 'template' && template && (
          <p className="text-sm text-white/70">
            {template.slots.length} photo{template.slots.length === 1 ? '' : 's'} per session.
          </p>
        )}
      </Section>

      {mode === 'strip' && (
        <Section title="Layout">
          <div className="flex gap-3">
            {STRIP_LAYOUTS.map((id) => (
              <Choice key={id} selected={layout === id} onClick={() => setLayout(id)}>
                <LayoutIcon id={id} />
                {LAYOUTS[id].label}
              </Choice>
            ))}
          </div>
        </Section>
      )}

      <Section title="Timer">
        <div className="flex gap-3">
          {[3, 5, 10].map((t) => (
            <Choice key={t} selected={settings.timer === t} onClick={() => updateSettings({ timer: t })}>
              {t}s
            </Choice>
          ))}
        </div>
        {mode !== 'single' && (
          <>
            <h3 className="pt-2 text-sm font-semibold text-white/70">Pause between shots</h3>
            <div className="flex gap-3">
              {[2, 3, 5].map((d) => (
                <Choice key={d} selected={settings.delay === d} onClick={() => updateSettings({ delay: d })}>
                  {d}s
                </Choice>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section title="Options">
        <Toggle label="Mirror preview and photos" checked={settings.mirror} onChange={(mirror) => updateSettings({ mirror })} />
        <Toggle label="Shutter sound" checked={settings.sound} onChange={(sound) => updateSettings({ sound })} />
        {mode !== 'template' && (
          <Toggle
            label="Kameramera watermark"
            checked={settings.watermark}
            onChange={(watermark) => updateSettings({ watermark })}
          />
        )}
      </Section>
      </div>

      <button type="button" onClick={startSession} className="btn-primary mx-auto flex w-full max-w-xl py-4 text-xl">
        Start
      </button>

      <div className="text-center">
        <label className="btn-secondary cursor-pointer focus-within:ring-4 focus-within:ring-kame-blue/60">
          Or upload a photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              void onUpload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {uploadError && (
          <p role="alert" className="pt-2 text-rec">
            {uploadError}
          </p>
        )}
      </div>
    </div>
  );
}

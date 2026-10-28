'use client';

import { layoutInfo } from '@/lib/layouts';
import { useBooth } from '@/store/booth';

export default function ReviewScreen() {
  const { shots, layout, activeEvent, startSession, retakeShot, goTo } = useBooth();
  const { aspect } = layoutInfo(layout, activeEvent?.template);
  const complete = shots.length > 0 && shots.every(Boolean);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Review your shots</h1>

      <ul className={`grid gap-4 ${shots.length === 1 ? 'mx-auto max-w-xl grid-cols-1' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'}`}>
        {shots.map((src, i) => (
          <li key={i} className="card space-y-3 p-3">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`Shot ${i + 1}`} style={{ aspectRatio: String(aspect) }} className="w-full rounded-2xl object-cover" />
            ) : (
              <div style={{ aspectRatio: String(aspect) }} className="flex w-full items-center justify-center rounded-2xl bg-black/40 text-white/60">
                Missing
              </div>
            )}
            <button type="button" className="btn-secondary w-full" onClick={() => retakeShot(i)}>
              Retake {shots.length > 1 ? `shot ${i + 1}` : ''}
            </button>
          </li>
        ))}
      </ul>

      <div className="mx-auto flex max-w-xl gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={startSession}>
          Retake all
        </button>
        <button type="button" className="btn-primary flex-1" disabled={!complete} onClick={() => goTo('result')}>
          Continue
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { CAMERA_ERROR_MESSAGES, useCamera } from '@/hooks/useCamera';
import { useCountdown } from '@/hooks/useCountdown';
import { grabFrame } from '@/lib/capture';
import { layoutInfo } from '@/lib/layouts';
import { playShutter, primeAudio } from '@/lib/sound';
import { useBooth } from '@/store/booth';
import CameraView from './CameraView';
import Countdown from './Countdown';
import FilterPicker from './FilterPicker';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function CaptureScreen() {
  const { layout, shots, retakeIndex, settings, filter, activeEvent, setFilter, setShot, goTo, finishRetake } = useBooth();
  const { videoRef, status, error, facing, canSwitch, start, switchCamera } = useCamera();
  const { value, start: startCountdown, cancel: cancelCountdown } = useCountdown();

  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const aborted = useRef(false);

  const { count, aspect } = layoutInfo(layout, activeEvent?.template);
  const mirrored = settings.mirror && facing === 'user';
  const retaking = retakeIndex !== null;

  useEffect(() => {
    return () => {
      aborted.current = true;
      cancelCountdown();
    };
  }, [cancelCountdown]);

  const run = async () => {
    const video = videoRef.current;
    if (busy || status !== 'ready' || !video) return;
    primeAudio();
    aborted.current = false;
    setBusy(true);

    const targets = retakeIndex !== null ? [retakeIndex] : Array.from({ length: count }, (_, i) => i);
    for (let n = 0; n < targets.length; n++) {
      setCurrent(targets[n]);
      const done = await startCountdown(settings.timer);
      if (!done || aborted.current) {
        setBusy(false);
        setCurrent(null);
        return;
      }
      setFlash(true);
      if (settings.sound) playShutter();
      setShot(targets[n], grabFrame(video, mirrored, aspect));
      setTimeout(() => setFlash(false), 180);

      if (n < targets.length - 1) {
        setWaiting(true);
        await sleep(settings.delay * 1000);
        setWaiting(false);
        if (aborted.current) {
          setBusy(false);
          setCurrent(null);
          return;
        }
      }
    }

    await sleep(500);
    if (aborted.current) return;
    setBusy(false);
    setCurrent(null);
    if (retaking) finishRetake();
    else goTo('review');
  };

  const cancel = () => {
    aborted.current = true;
    cancelCountdown();
    setWaiting(false);
  };

  const runRef = useRef(run);
  runRef.current = run;
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  // Stop a running session if the tab is hidden or the camera drops.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) cancelRef.current();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  useEffect(() => {
    if (error) cancelRef.current();
  }, [error]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
      e.preventDefault();
      void runRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const back = () => {
    cancel();
    if (retaking) finishRetake();
    else goTo('start');
  };

  if (error) {
    return (
      <div className="card mx-auto max-w-xl space-y-4 text-center" role="alert">
        <p>{CAMERA_ERROR_MESSAGES[error]}</p>
        <div className="flex justify-center gap-3">
          <button type="button" className="btn-primary" onClick={() => void start()}>
            Try again
          </button>
          <button type="button" className="btn-secondary" onClick={back}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="min-w-0 lg:flex-1">
        <CameraView videoRef={videoRef} mirrored={mirrored} filter={filter} aspect={aspect}>
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-navy-900/70">Starting camera…</div>
          )}
          {waiting && (
            <div className="absolute inset-x-0 bottom-4 text-center text-lg font-semibold drop-shadow">
              Next shot coming up…
            </div>
          )}
          <Countdown value={value} />
          <div
            className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${
              flash ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </CameraView>
      </div>

      <aside className="flex flex-col gap-5 lg:w-80 lg:shrink-0">
        <div className="flex items-center justify-between text-sm font-semibold text-white/80">
          <span>{retakeIndex !== null ? `Retaking shot ${retakeIndex + 1}` : count > 1 ? 'Photo strip' : 'Single shot'}</span>
          {count > 1 && !retaking && (
            <div className="flex gap-2" aria-label="Progress">
              {Array.from({ length: count }, (_, i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full ${
                    shots[i] ? 'bg-kame-cyan' : current === i ? 'bg-kame-yellow' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button type="button" className="btn-secondary" onClick={back}>
            Back
          </button>

          {busy ? (
            <button type="button" className="btn-secondary" onClick={cancel}>
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void run()}
              disabled={status !== 'ready'}
              aria-label="Take photo"
              className="h-20 w-20 rounded-full border-4 border-white bg-kame-yellow shadow-glow transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kame-blue/60 enabled:active:scale-90 disabled:opacity-50"
            />
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={switchCamera}
            disabled={!canSwitch || busy}
            aria-label="Switch camera"
          >
            Flip
          </button>
        </div>

        <FilterPicker value={filter} onChange={setFilter} />
        <p className="text-center text-sm text-white/60">Press Space to start</p>
      </aside>
    </div>
  );
}

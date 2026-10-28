'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraErrorKind = 'denied' | 'not-found' | 'in-use' | 'insecure' | 'lost' | 'unknown';
export type CameraStatus = 'idle' | 'starting' | 'ready' | 'error';

export const CAMERA_ERROR_MESSAGES: Record<CameraErrorKind, string> = {
  denied: 'Camera access was denied. Allow camera permission in your browser settings, then try again.',
  'not-found': 'No camera was found on this device.',
  'in-use': 'The camera is being used by another app or tab. Close it and try again.',
  insecure: 'Camera access needs a secure connection (HTTPS) or localhost.',
  lost: 'The camera was disconnected. Reconnect it and try again.',
  unknown: 'Could not start the camera. Please try again.',
};

function classify(e: unknown): CameraErrorKind {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found';
  if (name === 'NotReadableError' || name === 'AbortError') return 'in-use';
  return 'unknown';
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const token = useRef(0);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [facing, setFacing] = useState<'user' | 'environment'>('user');

  const stop = useCallback(() => {
    token.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      const mine = ++token.current;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStatus('starting');
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('insecure');
        setStatus('error');
        return;
      }

      const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: 'user', ...size },
          audio: false,
        });
        if (mine !== token.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        const track = stream.getVideoTracks()[0];
        track.addEventListener('ended', () => {
          if (mine !== token.current) return;
          setError('lost');
          setStatus('error');
        });
        const settings = track.getSettings();
        setActiveId(settings.deviceId);
        setFacing(settings.facingMode === 'environment' ? 'environment' : 'user');
        const all = await navigator.mediaDevices.enumerateDevices();
        if (mine !== token.current) return;
        setDevices(all.filter((d) => d.kind === 'videoinput'));
        setStatus('ready');
      } catch (e) {
        if (mine !== token.current) return;
        setError(classify(e));
        setStatus('error');
      }
    },
    [],
  );

  const switchCamera = useCallback(() => {
    if (devices.length < 2) return;
    const index = devices.findIndex((d) => d.deviceId === activeId);
    const next = devices[(index + 1) % devices.length];
    void start(next.deviceId);
  }, [devices, activeId, start]);

  useEffect(() => {
    void start();
    return stop;
  }, [start, stop]);

  return {
    videoRef,
    status,
    error,
    facing,
    canSwitch: devices.length > 1,
    start,
    switchCamera,
  };
}

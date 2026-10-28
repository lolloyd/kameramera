import { SLOT_ASPECT } from './layouts';

/** Grabs the current frame at native resolution, center-cropped to the given aspect. */
export function grabFrame(video: HTMLVideoElement, mirror: boolean, aspect: number = SLOT_ASPECT): string {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  let sw = vw;
  let sh = vh;
  if (vw / vh > aspect) {
    sw = Math.round(vh * aspect);
  } else {
    sh = Math.round(vw / aspect);
  }
  const sx = Math.round((vw - sw) / 2);
  const sy = Math.round((vh - sh) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  if (mirror) {
    ctx.translate(sw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/jpeg', 0.92);
}

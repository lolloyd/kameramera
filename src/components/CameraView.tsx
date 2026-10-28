import type { CSSProperties, RefObject, ReactNode } from 'react';
import { filterCss, type FilterId } from '@/lib/filters';
import { SLOT_ASPECT } from '@/lib/layouts';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  mirrored: boolean;
  filter?: FilterId;
  aspect?: number;
  children?: ReactNode;
}

export default function CameraView({ videoRef, mirrored, filter = 'none', aspect = SLOT_ASPECT, children }: Props) {
  const box: CSSProperties = { aspectRatio: String(aspect), width: `min(100%, ${(80 * aspect).toFixed(2)}vh)`, marginInline: 'auto' };
  return (
    <div
      style={box}
      className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black shadow-glow"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ filter: filterCss(filter) }}
        className={`absolute inset-0 h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
      />
      {children}
    </div>
  );
}

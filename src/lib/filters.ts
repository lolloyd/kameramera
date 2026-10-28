export type FilterId = 'none' | 'bw' | 'sepia' | 'vintage' | 'warm' | 'cool' | 'contrast';

type OpName = 'grayscale' | 'sepia' | 'contrast' | 'saturate' | 'brightness' | 'hue-rotate';
interface Op {
  fn: OpName;
  v: number;
}

export const FILTERS: { id: FilterId; label: string; ops: Op[] }[] = [
  { id: 'none', label: 'Normal', ops: [] },
  { id: 'bw', label: 'B&W', ops: [{ fn: 'grayscale', v: 1 }, { fn: 'contrast', v: 1.1 }] },
  { id: 'sepia', label: 'Sepia', ops: [{ fn: 'sepia', v: 0.85 }] },
  {
    id: 'vintage',
    label: 'Vintage',
    ops: [{ fn: 'sepia', v: 0.4 }, { fn: 'contrast', v: 1.1 }, { fn: 'saturate', v: 1.3 }, { fn: 'hue-rotate', v: -10 }],
  },
  { id: 'warm', label: 'Warm', ops: [{ fn: 'sepia', v: 0.25 }, { fn: 'saturate', v: 1.3 }, { fn: 'hue-rotate', v: -10 }] },
  { id: 'cool', label: 'Cool', ops: [{ fn: 'saturate', v: 1.1 }, { fn: 'hue-rotate', v: 15 }, { fn: 'brightness', v: 1.05 }] },
  { id: 'contrast', label: 'Punchy', ops: [{ fn: 'contrast', v: 1.4 }, { fn: 'saturate', v: 1.15 }] },
];

export function getOps(id: FilterId): Op[] {
  return FILTERS.find((f) => f.id === id)?.ops ?? [];
}

/** CSS filter string, or undefined for no filter. */
export function filterCss(id: FilterId): string | undefined {
  const ops = getOps(id);
  if (!ops.length) return undefined;
  return ops.map((o) => `${o.fn}(${o.v}${o.fn === 'hue-rotate' ? 'deg' : ''})`).join(' ');
}

export function supportsCtxFilter(): boolean {
  const ctx = document.createElement('canvas').getContext('2d');
  return !!ctx && 'filter' in ctx;
}

// Color matrices follow the W3C Filter Effects spec.
function matrix({ fn, v }: Op): number[] | null {
  switch (fn) {
    case 'grayscale': {
      const k = 1 - v;
      return [
        0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k,
        0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k,
        0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k,
      ];
    }
    case 'sepia': {
      const k = 1 - v;
      return [
        0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k,
        0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k,
        0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k,
      ];
    }
    case 'saturate':
      return [
        0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v,
        0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v,
        0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v,
      ];
    case 'hue-rotate': {
      const a = (v * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      return [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
      ];
    }
    default:
      return null;
  }
}

const clamp = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : n);

/** Per-pixel fallback for browsers without CanvasRenderingContext2D.filter (Safari). */
export function applyOps(image: ImageData, ops: Op[]) {
  const d = image.data;
  const steps = ops.map((op) => ({ op, m: matrix(op) }));
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    for (const { op, m } of steps) {
      if (m) {
        const nr = m[0] * r + m[1] * g + m[2] * b;
        const ng = m[3] * r + m[4] * g + m[5] * b;
        const nb = m[6] * r + m[7] * g + m[8] * b;
        r = clamp(nr);
        g = clamp(ng);
        b = clamp(nb);
      } else if (op.fn === 'brightness') {
        r = clamp(r * op.v);
        g = clamp(g * op.v);
        b = clamp(b * op.v);
      } else {
        const off = (0.5 - 0.5 * op.v) * 255;
        r = clamp(r * op.v + off);
        g = clamp(g * op.v + off);
        b = clamp(b * op.v + off);
      }
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
}

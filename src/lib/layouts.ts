import type { Template } from './events';

export type BuiltinLayoutId = '1x1' | '2x2' | 'strip4';
export type LayoutId = BuiltinLayoutId | 'custom';

export interface LayoutDef {
  id: BuiltinLayoutId;
  label: string;
  count: number;
  cols: number;
  rows: number;
  slotW: number;
  slotH: number;
}

export const SLOT_ASPECT = 4 / 3;

export const LAYOUTS: Record<BuiltinLayoutId, LayoutDef> = {
  '1x1': { id: '1x1', label: 'Single', count: 1, cols: 1, rows: 1, slotW: 960, slotH: 720 },
  '2x2': { id: '2x2', label: '2x2 Grid', count: 4, cols: 2, rows: 2, slotW: 720, slotH: 540 },
  strip4: { id: 'strip4', label: '4-Photo Strip', count: 4, cols: 1, rows: 4, slotW: 640, slotH: 480 },
};

export const STRIP_LAYOUTS: BuiltinLayoutId[] = ['strip4', '2x2'];

/** Shot count and capture aspect ratio for any layout, including an event template. */
export function layoutInfo(layout: LayoutId, template?: Template | null): { count: number; aspect: number } {
  if (layout === 'custom') {
    const first = template?.slots[0];
    return { count: template?.slots.length ?? 1, aspect: first ? first.w / first.h : SLOT_ASPECT };
  }
  return { count: LAYOUTS[layout].count, aspect: SLOT_ASPECT };
}

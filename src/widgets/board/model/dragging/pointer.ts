import type { XY } from '@/entities/board';
import type { PointerPos } from '../types';

/** Pointer position relative to the viewport box. Works for React and native mouse/pointer events. */
export function viewportPoint(e: { clientX: number; clientY: number }, vp: HTMLElement | null): XY {
  const r = vp?.getBoundingClientRect();
  return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
}

export function pointerPos(
  e: { clientX: number; clientY: number },
  vp: HTMLElement | null,
): PointerPos {
  const { x, y } = viewportPoint(e, vp);
  return { sx: x, sy: y, clientX: e.clientX, clientY: e.clientY };
}

'use client';

import { useEffect, type RefObject } from 'react';
import type { BoardStore } from '../useBoardStore';
import type { PointerTracker } from '../dragging/usePointerTracker';

/** Ниже этого изменения расстояния масштаб не трогаем — иначе дрожь пальцев ползёт в зум. */
const PINCH_DEADZONE = 0.004;

/**
 * Щипок двумя пальцами: масштаб и перенос холста.
 *
 * Отдельно от `useBoardWheel`, потому что это другой источник событий: тачпад
 * шлёт `wheel` с `ctrlKey`, а касание — `touchmove`, и pointer-события щипок не
 * описывают вовсе (их пришлось бы собирать из двух независимых указателей).
 *
 * Второй палец обрывает начатое перетаскивание: холст под ним уже поехал, и
 * доводить жест до конца значило бы создать блок или штрих там, где человек
 * всего лишь менял масштаб.
 */
export function useBoardPinch(
  { dispatch, stateRef }: BoardStore,
  vpRef: RefObject<HTMLDivElement | null>,
  tracker: PointerTracker,
) {
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;

    /** Расстояние между пальцами и их середина — в координатах вьюпорта. */
    const measure = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      const r = el.getBoundingClientRect();
      return {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        cx: (a.clientX + b.clientX) / 2 - r.left,
        cy: (a.clientY + b.clientY) / 2 - r.top,
      };
    };

    let last: ReturnType<typeof measure> | null = null;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2 || tracker.onUi.current) return;
      if (stateRef.current.drag.type !== 'none') dispatch({ type: 'DRAG_CANCEL' });
      last = measure(e.touches);
    };

    const onMove = (e: TouchEvent) => {
      if (!last || e.touches.length !== 2) return;
      e.preventDefault();
      const now = measure(e.touches);

      if (last.dist > 0 && now.dist > 0) {
        const factor = now.dist / last.dist;
        if (Math.abs(factor - 1) > PINCH_DEADZONE) {
          dispatch({ type: 'ZOOM_AT', factor, mx: now.cx, my: now.cy });
        }
      }
      // Середина между пальцами тянет холст: щипок и перенос — один жест.
      dispatch({ type: 'PAN_BY', dx: now.cx - last.cx, dy: now.cy - last.cy });
      last = now;
    };

    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) last = null;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [dispatch, stateRef, vpRef, tracker]);
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from '@/shared/lib/haptics';

/**
 * Сколько палец должен простоять на месте. 500 мс — привычный порог: столько же
 * ждут iOS и Android, прежде чем показать своё меню по долгому нажатию.
 */
export const LONG_PRESS_MS = 500;

/** Дрожь пальца движением не считается; дальше этого порога жест — перетаскивание. */
const MOVE_TOLERANCE_PX = 10;

export interface LongPress {
  /** Палец стоит и отсчёт идёт — по этому флагу рисуется отклик на нажатие. */
  pressing: boolean;
  start: (e: React.PointerEvent) => void;
  cancel: () => void;
}

/**
 * Долгое нажатие пальцем: жест, которого на мыши нет и быть не должно.
 *
 * Мышь пропускается сразу — там для тех же действий есть правая кнопка и
 * двойной клик, а курсор, замерший на блоке, ничего означать не может.
 *
 * Движение и отрыв слушаются на окне, а не на самом блоке: доска заводит
 * перетаскивание тем же нажатием, и блок успевает уехать из-под пальца — его
 * собственные события до конца жеста уже не доходят.
 */
export function useLongPress(onFire: () => void): LongPress {
  const [pressing, setPressing] = useState(false);
  const timer = useRef(0);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    origin.current = null;
    setPressing(false);
  }, []);

  const start = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    window.clearTimeout(timer.current);
    origin.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    timer.current = window.setTimeout(() => {
      origin.current = null;
      setPressing(false);
      haptic();
      onFire();
    }, LONG_PRESS_MS);
  };

  useEffect(() => {
    if (!pressing) return;

    const onMove = (e: PointerEvent) => {
      const from = origin.current;
      if (!from) return;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > MOVE_TOLERANCE_PX) cancel();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cancel);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cancel);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [pressing, cancel]);

  // Размонтирование посреди жеста: блок могли удалить чужой правкой или уходом с доски.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { pressing, start, cancel };
}

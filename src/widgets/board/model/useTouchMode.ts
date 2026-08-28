'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEF_TOUCH_MODE, isTouchMode, type TouchMode } from './touchModes';

const KEY = 'board_touch_mode_v1';

/**
 * Выбранная раскладка жестов.
 *
 * Хранится отдельно от настроек доски и не привязана ни к доске, ни к
 * воркспейсу: это свойство руки, а не документа — переключать управление при
 * переходе на соседнюю доску было бы дико.
 *
 * До первого эффекта отдаёт режим по умолчанию: на сервере хранилища нет, а
 * разошедшаяся гидрация стоит дороже одного кадра со стандартной раскладкой.
 */
export function useTouchMode() {
  const [mode, setModeState] = useState<TouchMode>(DEF_TOUCH_MODE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (isTouchMode(stored)) setModeState(stored);
    } catch {
      // Приватный режим Safari: остаёмся на раскладке по умолчанию.
    }
  }, []);

  const setMode = useCallback((next: TouchMode) => {
    setModeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Не сохранилось — переживёт хотя бы эту сессию.
    }
  }, []);

  return { mode, setMode };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Подсказка про долгое нажатие — тому, кто про него ещё не знает.
 *
 * Правку блока на телефоне открывает жест, а жест ничем себя не выдаёт: тап по
 * блоку его выделяет, и на этом видимая история заканчивается. Поэтому ровно в
 * этот момент — блок выбран, а дальше человек не знает, что делать, — снизу
 * всплывает строка про то, что блок можно зажать.
 *
 * Один раз сделанный жест снимает подсказку навсегда: дальше она была бы
 * напоминанием о том, что человек и так помнит руками.
 */

const KEY = 'board_touch_hint_v1';

/** Сколько подсказка висит. Хватает прочитать строку и не успевает надоесть. */
const HINT_MS = 2500;

export interface GestureHint {
  visible: boolean;
  show: () => void;
  /** Жест сделан — больше не подсказываем ни в этой сессии, ни в следующих. */
  markGestureLearned: () => void;
}

export function useGestureHint(): GestureHint {
  const [visible, setVisible] = useState(false);
  /**
   * До ответа localStorage считаем, что жест знают: показать подсказку позже
   * можно, а вот отобрать мелькнувшую у знающего человека — уже нет.
   */
  const learned = useRef(true);
  const timer = useRef(0);

  useEffect(() => {
    try {
      learned.current = localStorage.getItem(KEY) === '1';
    } catch {
      learned.current = true;
    }
  }, []);

  const show = useCallback(() => {
    if (learned.current) return;
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), HINT_MS);
  }, []);

  const markGestureLearned = useCallback(() => {
    learned.current = true;
    window.clearTimeout(timer.current);
    setVisible(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Приватный режим Safari: подсказка просто вернётся в следующий раз.
    }
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // `show` и `markGestureLearned` постоянны намеренно: их берут внутрь
  // обработчиков блока, а те собраны в один объект на весь холст и
  // пересобираться не должны.
  return { visible, show, markGestureLearned };
}

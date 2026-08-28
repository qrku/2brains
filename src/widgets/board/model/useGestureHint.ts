'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TouchMode } from './touchModes';

/**
 * Подсказка про жесты блока — тому, кто про них ещё не знает.
 *
 * Жест ничем себя не выдаёт: тап по блоку что-то делает, и на этом видимая
 * история заканчивается. Поэтому ровно в тот момент, когда блок выбран, а
 * дальше человек не знает, что делать, снизу всплывает строка про жесты.
 *
 * Один раз сделанный жест снимает подсказку навсегда: дальше она была бы
 * напоминанием о том, что человек и так помнит руками. Память своя на каждый
 * режим — раскладки разные, и освоенная одна ничего не говорит про другую.
 */

const KEY = 'board_touch_hint_v1';

/** Сколько подсказка висит. Хватает прочитать строку и не успевает надоесть. */
const HINT_MS = 2500;

export interface GestureHint {
  visible: boolean;
  show: () => void;
  /** Убрать раньше срока: момент прошёл — начался перенос, открылось окно. */
  hide: () => void;
  /** Жест сделан — больше не подсказываем ни в этой сессии, ни в следующих. */
  markGestureLearned: () => void;
}

export function useGestureHint(mode: TouchMode): GestureHint {
  const [visible, setVisible] = useState(false);
  /**
   * До ответа localStorage считаем, что жест знают: показать подсказку позже
   * можно, а вот отобрать мелькнувшую у знающего человека — уже нет.
   */
  const learned = useRef(true);
  const timer = useRef(0);
  const key = `${KEY}__${mode}`;

  useEffect(() => {
    try {
      learned.current = localStorage.getItem(key) === '1';
    } catch {
      learned.current = true;
    }
  }, [key]);

  const show = useCallback(() => {
    if (learned.current) return;
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), HINT_MS);
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setVisible(false);
  }, []);

  const markGestureLearned = useCallback(() => {
    learned.current = true;
    window.clearTimeout(timer.current);
    setVisible(false);
    try {
      localStorage.setItem(key, '1');
    } catch {
      // Приватный режим Safari: подсказка просто вернётся в следующий раз.
    }
  }, [key]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // `show`, `hide` и `markGestureLearned` постоянны намеренно: их берут внутрь
  // обработчиков блока, а те собраны в один объект на весь холст и
  // пересобираться не должны.
  return { visible, show, hide, markGestureLearned };
}

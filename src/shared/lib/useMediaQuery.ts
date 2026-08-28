'use client';

import { useEffect, useState } from 'react';

/**
 * Подписка на медиазапрос из React.
 *
 * Нужна там, где на узком экране меняется не оформление, а поведение, и одной
 * разметкой не обойтись: например, нажатие на день календаря открывает разные
 * окна. Всё, что решается через CSS, через CSS и должно решаться — этот хук
 * заставляет компонент перерисовываться на каждом изменении ширины.
 *
 * До первого эффекта возвращает `false`: на сервере окна нет, а разошедшаяся с
 * разметкой гидрация стоит дороже одного лишнего кадра в широком варианте.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);

  return matches;
}

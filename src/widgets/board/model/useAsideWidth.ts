'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'board_aside_width_v1';
export const ASIDE_MIN_W = 280;
export const ASIDE_MAX_W = 900;
const ASIDE_DEFAULT_W = 360;

const clampWidth = (w: number) => Math.min(ASIDE_MAX_W, Math.max(ASIDE_MIN_W, Math.round(w)));

/**
 * Ширина панели с файлом, тянущаяся за левый край.
 *
 * Ширина запоминается между сессиями: панель на доске держат открытой подолгу, и подгонять её
 * заново на каждом заходе — лишняя работа. Верхняя граница не даёт утянуть панель так, что от
 * холста ничего не останется; она же ограничивает ширину при переходе на узкий экран.
 */
export function useAsideWidth() {
  const [width, setWidth] = useState(ASIDE_DEFAULT_W);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      if (saved) setWidth(clampWidth(saved));
    } catch {}
  }, []);

  // Перетаскивание слушает окно, а не сам разделитель: курсор во время быстрого движения
  // уходит с узкой полоски, и события на ней перестают приходить.
  const startRef = useRef<{ x: number; w: number } | null>(null);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startRef.current = { x: e.clientX, w: width };
      setResizing(true);
    },
    [width],
  );

  useEffect(() => {
    if (!resizing) return;

    // Панель прижата к правому краю, поэтому движение влево её расширяет.
    const onMove = (e: MouseEvent) => {
      const start = startRef.current;
      if (start) setWidth(clampWidth(start.w + (start.x - e.clientX)));
    };
    const onUp = () => {
      setResizing(false);
      startRef.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing]);

  // Пишем только по окончании жеста: во время перетаскивания это сотни записей в localStorage.
  useEffect(() => {
    if (resizing) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch {}
  }, [resizing, width]);

  return { width, resizing, onResizeStart };
}

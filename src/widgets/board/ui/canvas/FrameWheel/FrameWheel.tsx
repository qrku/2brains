'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BNode } from '@/entities/board';
import { Icon } from '@/shared/ui/Icon';
import type { PointerTracker } from '../../../model/dragging/usePointerTracker';
import { cx } from '@/shared/lib/cx';
import styles from './FrameWheel.module.css';

const ITEM_H = 38;
const SLOTS = 5; // visible rows: the centre plus two on each side
const PAD = ITEM_H * ((SLOTS - 1) / 2); // spacer so the first/last frame can reach the centre
const VIEW_H = ITEM_H * SLOTS;

interface Props {
  /** Frames in spatial (top-to-bottom) order; the index also drives their number badge. */
  frames: BNode[];
  activeId: string | null;
  onFocus: (id: string) => void;
  uiProps: PointerTracker['uiProps'];
}

/**
 * An iOS-timer-style wheel of frames: the centred one is in full focus and neighbours fade with
 * distance. Scrolling only spins the wheel; the board jumps only when a frame is clicked.
 */
export function FrameWheel({ frames, activeId, onFocus, uiProps }: Props) {
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? frames.filter((f) => (f.text || 'Фрейм').toLowerCase().includes(q)) : frames),
    [frames, q],
  );
  const numberOf = useMemo(() => {
    const m = new Map<string, number>();
    frames.forEach((f, i) => m.set(f.id, i + 1));
    return m;
  }, [frames]);

  // Bring the active frame to the centre when the list opens, is searched, or is selected elsewhere.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const i = Math.max(
      0,
      shown.findIndex((f) => f.id === activeId),
    );
    el.scrollTop = i * ITEM_H;
    setScrollTop(i * ITEM_H);
  }, [shown, activeId]);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  // Scrolling only spins the wheel (updates the focus falloff) — it never moves the board.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => setScrollTop(el.scrollTop));
  };

  // The board only jumps when a frame is picked from the list.
  const onItemClick = (id: string) => onFocus(id);

  if (frames.length === 0) return null;

  const center = scrollTop / ITEM_H;

  return (
    <div className={styles['board-wheel']} {...uiProps}>
      <div className={styles['board-wheel-search']}>
        <Icon name="search" size={12} />
        <input
          className={styles['board-wheel-input']}
          value={query}
          placeholder="Фреймы"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
        />
      </div>

      <div className={styles['board-wheel-viewport']} style={{ height: VIEW_H }}>
        <div
          ref={scrollRef}
          className={styles['board-wheel-scroll']}
          style={{ height: VIEW_H }}
          onScroll={onScroll}
        >
          <div style={{ height: PAD, flexShrink: 0 }} />
          {shown.length === 0 && (
            <div className={styles['board-wheel-empty']}>Ничего не найдено</div>
          )}
          {shown.map((f, i) => {
            const d = Math.abs(i - center);
            const opacity = Math.max(0.08, 1 - d * 0.35); // centre 1 · ±1 ≈0.65 · ±2 ≈0.30
            const scale = Math.max(0.72, 1 - d * 0.09);
            return (
              <button
                key={f.id}
                className={cx(
                  styles['board-wheel-item'],
                  Math.round(center) === i && styles.center,
                )}
                style={{ height: ITEM_H, opacity, transform: `scale(${scale})` }}
                title={f.text || 'Фрейм'}
                onClick={() => onItemClick(f.id)}
              >
                <span className={styles['board-wheel-idx']}>{numberOf.get(f.id)}</span>
                <span className={styles['board-wheel-name']}>{f.text || 'Фрейм'}</span>
              </button>
            );
          })}
          <div style={{ height: PAD, flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
}

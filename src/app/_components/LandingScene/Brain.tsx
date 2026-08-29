'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './LandingScene.module.css';

/**
 * Два глаза, следящих за курсором.
 *
 * Зрачков нет — и взгляд, и эмоция выражены только формой: пара целиком
 * сдвигается и подкручивается в сторону курсора, а настроение меняет пропорции
 * самих глаз (прищур, распахнутость, встречный наклон). Всё это — CSS-переменные
 * на контейнере: JS считает числа, раскладку по ним делают стили.
 */
type Mood = 'idle' | 'look' | 'happy' | 'surprised' | 'skeptical';

/* Поле зрения: на таком удалении по горизонтали и вертикали взгляд уходит до
   упора. Значения больше половины экрана — иначе глаза упираются в край почти
   сразу и перестают реагировать на движение. */
const RANGE_X = 560;
const RANGE_Y = 400;
/* Ближе этого расстояния до центра глаз курсор считается «рядом» — щурятся. */
const NEAR = 190;
/* Скорость курсора (px/ms), на которой глаза распахиваются от неожиданности. */
const FAST = 2.2;
const SURPRISE_MS = 520;
/* Столько без движения — и взгляд возвращается в покой. */
const CALM_MS = 2400;

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export function Brain() {
  const ref = useRef<HTMLDivElement>(null);
  const [mood, setMood] = useState<Mood>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Слежение — движение ради движения: при запрете анимаций глаза остаются в
    // покое, и обработчики даже не навешиваются.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Прямоугольник глаз меряется не в каждом кадре: чтение геометрии на
    // pointermove заставляло бы браузер пересчитывать раскладку 60 раз в секунду.
    let box = el.getBoundingClientRect();
    const remeasure = () => {
      box = el.getBoundingClientRect();
    };

    // Настроение дублируется в переменной: обработчики живут вне рендера и
    // читать через них состояние React было бы просто устаревшим замыканием.
    let current: Mood = 'idle';
    const settle = (next: Mood) => {
      if (next === current) return;
      current = next;
      setMood(next);
    };

    const aim = (nx: number, ny: number) => {
      el.style.setProperty('--nx', nx.toFixed(3));
      el.style.setProperty('--ny', ny.toFixed(3));
    };

    type Point = { x: number; y: number; t: number };
    let frame = 0;
    let queued: Point | null = null;
    let prev: Point | null = null;
    let surprisedUntil = 0;
    let calm: ReturnType<typeof setTimeout> | undefined;
    let recheck: ReturnType<typeof setTimeout> | undefined;
    let wander: ReturnType<typeof setTimeout> | undefined;

    const relax = () => {
      settle('idle');
      aim(0, 0);
    };

    /* Испуг живёт по таймеру, а не до следующего движения: иначе резкий рывок с
       остановкой оставлял бы глаза выпученными до самого возврата в покой. */
    const scheduleRecheck = () => {
      clearTimeout(recheck);
      recheck = setTimeout(() => {
        if (!prev) return;
        queued = { ...prev, t: performance.now() };
        if (!frame) frame = requestAnimationFrame(apply);
      }, SURPRISE_MS + 30);
    };

    function apply() {
      frame = 0;
      const p = queued;
      queued = null;
      if (!p) return;

      const dx = p.x - (box.left + box.width / 2);
      const dy = p.y - (box.top + box.height / 2);
      const nx = clamp1(dx / RANGE_X);
      aim(nx, clamp1(dy / RANGE_Y));

      const speed =
        prev && p.t > prev.t ? Math.hypot(p.x - prev.x, p.y - prev.y) / (p.t - prev.t) : 0;
      prev = p;
      if (speed > FAST) {
        surprisedUntil = p.t + SURPRISE_MS;
        scheduleRecheck();
      }

      if (p.t < surprisedUntil) settle('surprised');
      else if (Math.hypot(dx, dy) < NEAR) settle('happy');
      else if (Math.abs(nx) > 0.92) settle('skeptical');
      else settle('look');
    }

    const onMove = (e: PointerEvent) => {
      queued = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      if (!frame) frame = requestAnimationFrame(apply);
      clearTimeout(calm);
      calm = setTimeout(relax, CALM_MS);
    };

    const onDown = (e: PointerEvent) => {
      // Тапу неоткуда взять скорость, поэтому испуг ставится напрямую.
      surprisedUntil = e.timeStamp + SURPRISE_MS;
      queued = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      prev = queued;
      if (!frame) frame = requestAnimationFrame(apply);
      scheduleRecheck();
      clearTimeout(calm);
      calm = setTimeout(relax, CALM_MS);
    };

    /* На телефоне курсора нет вовсе, да и на десктопе страница открывается до
       первого движения мыши. Чтобы глаза не стояли стеклянно, в покое они сами
       поглядывают по сторонам. */
    const glance = () => {
      wander = setTimeout(
        () => {
          if (current === 'idle') {
            aim((Math.random() * 2 - 1) * 0.55, (Math.random() * 2 - 1) * 0.4);
          }
          glance();
        },
        2200 + Math.random() * 2800,
      );
    };
    glance();

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, { passive: true });
    document.addEventListener('pointerleave', relax);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure);
      document.removeEventListener('pointerleave', relax);
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(calm);
      clearTimeout(recheck);
      clearTimeout(wander);
    };
  }, []);

  return (
    <div className={styles.ovals} data-mood={mood} ref={ref}>
      <div className={`${styles.eye} ${styles['eye-l']}`}>
        <div className={`${styles.oval} ${styles['oval-l']}`} />
      </div>
      <div className={`${styles.eye} ${styles['eye-r']}`}>
        <div className={`${styles.oval} ${styles['oval-r']}`} />
      </div>
    </div>
  );
}

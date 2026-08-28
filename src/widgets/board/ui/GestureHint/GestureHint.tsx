import { cx } from '@/shared/lib/cx';
import styles from './GestureHint.module.css';

/**
 * Строка про жесты блока, всплывающая над нижней панелью.
 *
 * Оба жеста ничем себя не выдают: тап только выделяет, а перенос и правка
 * спрятаны за долгим нажатием и двойным тапом.
 *
 * В разметке живёт всегда: появление и уход — это переход прозрачности, а
 * размонтированному элементу переходить не из чего.
 */
export function GestureHint({ visible }: { visible: boolean }) {
  return (
    <div
      className={cx(styles['board-gesture-hint'], visible && styles.on)}
      aria-hidden={!visible}
      role="status"
    >
      Зажать — перетащить · Двойной тап — правка
    </div>
  );
}

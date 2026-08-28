import { cx } from '@/shared/lib/cx';
import styles from './GestureHint.module.css';

/**
 * Строка про долгое нажатие, всплывающая над нижней панелью.
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
      Зажмите блок — правка и настройки
    </div>
  );
}

import { cx } from '@/shared/lib/cx';
import styles from './GestureHint.module.css';

/**
 * Строка про жесты блока, всплывающая над нижней панелью.
 *
 * Текст приходит от выбранной раскладки (см. touchModes): в разных режимах одно
 * и то же касание делает разное, и рассказывать нужно ровно про текущий.
 *
 * В разметке живёт всегда: появление и уход — это переход прозрачности, а
 * размонтированному элементу переходить не из чего.
 */
export function GestureHint({ visible, text }: { visible: boolean; text: string }) {
  return (
    <div
      className={cx(styles['board-gesture-hint'], visible && styles.on)}
      aria-hidden={!visible}
      role="status"
    >
      {text}
    </div>
  );
}

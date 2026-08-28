import { DRAW_COLORS } from '@/entities/board';
import { Icon } from '@/shared/ui/Icon';
import { cx } from '@/shared/lib/cx';
// Reuses PropertyBars' bp-* vocabulary — same floating-bar controls, same markup.
import styles from './PropertyBars/PropertyBars.module.css';

interface Props {
  color: string;
  width: number;
  onColor: (color: string) => void;
  onWidth: (delta: number) => void;
}

/**
 * Colour swatches + thickness stepper. Shared by the pencil panel (settings for the *next*
 * stroke) and the property bar (settings of the *selected* stroke) — same controls, same markup.
 */
export function StrokeControls({ color, width, onColor, onWidth }: Props) {
  return (
    <>
      {DRAW_COLORS.map((c) => (
        <button
          key={c}
          className={cx(styles['bp-btn'], styles['bp-swatch'], color === c && styles.active)}
          style={{ background: c }}
          title={c}
          onClick={() => onColor(c)}
        />
      ))}
      <div className={styles['bp-sep']} />
      <button className={styles['bp-btn']} onClick={() => onWidth(-1)} title="Тоньше">
        <Icon name="remove" size={13} />
      </button>
      <span className={styles['bp-val']}>{width}px</span>
      <button className={styles['bp-btn']} onClick={() => onWidth(+1)} title="Толще">
        <Icon name="add" size={13} />
      </button>
    </>
  );
}

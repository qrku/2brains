import { memo, type CSSProperties } from 'react';
import { ICONS } from './icons.generated';

// Таблица иконок генерируется и лежит отдельным модулем — здесь только компонент.
// Так файл проходит обычные lint и prettier, а регенерация набора его не затирает.
export { ICONS };

export type IconName = keyof typeof ICONS;

/**
 * Готовые объекты для `dangerouslySetInnerHTML`, по одному на иконку.
 *
 * React сравнивает пропсы по ссылке, и литерал `{ __html: ... }` прямо в разметке —
 * каждый рендер новый объект. Для обычного пропа это ничего не стоит, а здесь равносильно
 * `svg.innerHTML = ...`: браузер заново разбирает разметку иконки, хотя строка та же.
 * На доске, которая перерисовывается на каждое движение указателя, это сотни разборов
 * HTML в секунду. Стабильная ссылка убирает их полностью — React просто не видит правки.
 */
const ICON_HTML = Object.fromEntries(
  Object.entries(ICONS).map(([name, icon]) => [name, { __html: icon.html }]),
) as Record<IconName, { __html: string }>;

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export const Icon = memo(function Icon({ name, size = 18, className, style }: Props) {
  const icon = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={ICON_HTML[name]}
    />
  );
});

import type { IconName } from '@/shared/ui/Icon';

/* ─── Slash commands ──────────────────────────────────────────────────────── */
export interface Cmd {
  id: string;
  icon: string;
  svgIcon?: IconName; // when set, renders in place of the text glyph in `icon`
  label: string;
  group: string;
  /**
   * Шаблон в синтаксисе сниппетов CodeMirror: `${}` — пустая позиция каретки,
   * `${подсказка}` — заполнитель с текстом, который выделяется при вставке.
   * Tab переводит к следующей позиции.
   */
  snippet: string;
  search?: string; // extra search aliases (English keywords etc.)
}

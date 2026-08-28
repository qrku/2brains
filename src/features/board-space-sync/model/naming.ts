import { stripSpaceRefs } from '@/entities/board';

/** Расширение файлов Пространства — дерево показывает его как есть. */
export const FILE_EXT = '.md';

/** Имя, когда подпись ноды или фрейма пустая. */
export const FALLBACK_NAME = 'Без названия';

/** Длиннее этого имя в дереве всё равно обрезается многоточием, а путь становится нечитаемым. */
const MAX_NAME_LEN = 60;

/**
 * Подпись ноды → безопасный сегмент пути.
 *
 * Берётся первая непустая строка: подпись ноды бывает многострочной, а имя файла — нет.
 * Ссылки на файлы (`[[space:id|Имя]]`) схлопываются в свою видимую подпись — в тексте ноды
 * они выглядят как обычные слова, и в имени должны выглядеть так же. Слэш вырезается всегда:
 * пути в Пространстве разбираются по нему, и имя с ним стало бы двумя сегментами.
 */
export function sanitizeName(raw: string): string {
  const firstLine =
    stripSpaceRefs(raw)
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? '';

  const cleaned = firstLine
    // Разделители пути — в пробел, чтобы слова по краям не слиплись.
    .replace(/[/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LEN)
    .trim();

  return cleaned || FALLBACK_NAME;
}

/** Имя файла для ноды: подпись + `.md`. */
export const fileNameFor = (text: string): string => `${sanitizeName(text)}${FILE_EXT}`;

/** Имя папки для фрейма — то же самое, но без расширения. */
export const folderNameFor = (text: string): string => sanitizeName(text);

/**
 * Первое свободное имя в папке: `Идея.md`, `Идея 2.md`, `Идея 3.md`, …
 *
 * Две ноды с одинаковой подписью — обычное дело, а приложение не запрещает одноимённые узлы
 * в одной папке. Без развода имён такая пара делала бы путь неоднозначным, и инструменты
 * агента (`resolvePath`) отказывались бы работать с обоими файлами.
 */
export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;

  const ext = name.endsWith(FILE_EXT) ? FILE_EXT : '';
  const base = ext ? name.slice(0, -ext.length) : name;

  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
}

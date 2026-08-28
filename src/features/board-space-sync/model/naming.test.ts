import { spaceRefNotation } from '@/entities/board';
import { fileNameFor, folderNameFor, sanitizeName, uniqueName } from './naming';

describe('sanitizeName', () => {
  it('берёт первую непустую строку многострочной подписи', () => {
    expect(sanitizeName('\n  Кэширование  \nвторая строка')).toBe('Кэширование');
  });

  it('схлопывает ссылку на файл в её видимую подпись', () => {
    const text = `Смотри ${spaceRefNotation({ id: 'f1', name: 'Индексы' })} подробнее`;

    expect(sanitizeName(text)).toBe('Смотри Индексы подробнее');
  });

  it('вырезает разделители пути', () => {
    expect(sanitizeName('Очередь / Кафка')).toBe('Очередь Кафка');
    expect(sanitizeName('a\\b')).toBe('a b');
  });

  it('схлопывает пробелы', () => {
    expect(sanitizeName('Много    пробелов')).toBe('Много пробелов');
  });

  it('сохраняет обычную пунктуацию', () => {
    expect(sanitizeName('Кэш: LRU, TTL — 5m (v2)')).toBe('Кэш: LRU, TTL — 5m (v2)');
  });

  it('обрезает слишком длинное имя', () => {
    expect(sanitizeName('я'.repeat(200))).toHaveLength(60);
  });

  it('подставляет запасное имя вместо пустого', () => {
    expect(sanitizeName('   \n  ')).toBe('Без названия');
    expect(sanitizeName('///')).toBe('Без названия');
  });
});

describe('fileNameFor / folderNameFor', () => {
  it('файл получает расширение, папка — нет', () => {
    expect(fileNameFor('Идея')).toBe('Идея.md');
    expect(folderNameFor('Идея')).toBe('Идея');
  });
});

describe('uniqueName', () => {
  it('оставляет свободное имя как есть', () => {
    expect(uniqueName('Идея.md', new Set())).toBe('Идея.md');
  });

  it('нумерует занятые, вставляя номер перед расширением', () => {
    expect(uniqueName('Идея.md', new Set(['Идея.md']))).toBe('Идея 2.md');
    expect(uniqueName('Идея.md', new Set(['Идея.md', 'Идея 2.md']))).toBe('Идея 3.md');
  });

  it('нумерует папки без расширения', () => {
    expect(uniqueName('Фрейм', new Set(['Фрейм']))).toBe('Фрейм 2');
  });
});

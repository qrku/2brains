import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { Highlight } from './highlightSyntax';
import { slashSource } from './slash';

/** Состояние с кареткой сразу после `|` в тексте (сам символ в документ не идёт). */
function contextAt(marked: string): CompletionContext {
  const pos = marked.indexOf('|');
  const doc = marked.replace('|', '');
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage, extensions: [Highlight] })],
  });
  // Источник смотрит в дерево разбора, чтобы отличить команду от текста в коде.
  ensureSyntaxTree(state, doc.length, 500);
  return new CompletionContext(state, pos, false);
}

const labels = (marked: string) =>
  (slashSource(contextAt(marked))?.options ?? []).map((o) => o.label);

describe('меню «/»', () => {
  it('открывается на пустом «/» со всеми командами', () => {
    const result = slashSource(contextAt('/|'));
    expect(result?.from).toBe(0);
    expect(result?.options.length).toBeGreaterThan(15);
  });

  it('фильтрует по названию', () => {
    expect(labels('/заголовок|')).toEqual([
      'Заголовок 1',
      'Заголовок 2',
      'Заголовок 3',
      'Заголовок 4',
      'Заголовок 5',
      'Заголовок 6',
    ]);
  });

  it('ищет по англоязычному синониму', () => {
    expect(labels('/spoiler|')).toEqual(['Детали / Спойлер']);
  });

  it('ищет по названию группы', () => {
    expect(labels('/формат|')).toContain('Жирный');
  });

  it('открывается после пробела посреди строки', () => {
    expect(labels('текст /цит|')).toEqual(['Цитата']);
  });

  it('молчит, когда «/» — часть слова: путь, а не команда', () => {
    expect(slashSource(contextAt('src/app|'))).toBeNull();
    expect(slashSource(contextAt('и/или|'))).toBeNull();
  });

  it('молчит внутри блока кода', () => {
    expect(slashSource(contextAt('```\n/заг|\n```'))).toBeNull();
  });

  it('молчит, когда под запрос ничего не подходит', () => {
    expect(slashSource(contextAt('/абракадабра|'))).toBeNull();
  });

  it('раскладывает команды по группам и вставляет их сниппетом', () => {
    const options = slashSource(contextAt('/|'))?.options ?? [];
    const bold = options.find((o) => o.label === 'Жирный');
    expect(bold?.section).toBe('Формат');
    expect(typeof bold?.apply).toBe('function');
  });
});

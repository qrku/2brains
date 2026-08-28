import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown';
import { insertNewlineAndIndent } from '@codemirror/commands';
import { ensureSyntaxTree } from '@codemirror/language';
import { spaceEditorExtensions } from './setup';

/**
 * Сборка целиком: настоящий EditorView со всеми расширениями. Юнит-тесты проверяют,
 * какие декорации построены; здесь — что они доезжают до DOM и что документ при
 * этом остаётся markdown-текстом, а не превращается в HTML.
 */
function mount(doc: string, cursor = 0): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: { anchor: cursor },
      extensions: spaceEditorExtensions('пусто'),
    }),
  });
}

let view: EditorView | null = null;
afterEach(() => {
  view?.destroy();
  view = null;
  document.body.innerHTML = '';
});

describe('редактор целиком', () => {
  it('прячет разметку, оставляя читаемый текст', () => {
    view = mount('# Заголовок\n\n**жирно** и *курсив*', 0);
    const shown = view.contentDOM.textContent ?? '';
    // Вью не в фокусе, поэтому раскрытой строки нет ни одной — включая ту, где
    // стоит каретка. Иначе только что открытый файл встречал бы решёткой.
    expect(shown).toContain('Заголовок');
    expect(shown).not.toContain('# Заголовок');
    expect(shown).toContain('жирно');
    expect(shown).not.toContain('**жирно**');
    expect(view.contentDOM.querySelector('.cm-md-h1')).not.toBeNull();
    expect(view.contentDOM.querySelector('.cm-md-strong')).not.toBeNull();
  });

  it('рисует чекбокс задачи как настоящий input', () => {
    view = mount('- [x] сделано');
    const box = view.contentDOM.querySelector<HTMLInputElement>('input.md-checkbox');
    expect(box).not.toBeNull();
    expect(box!.checked).toBe(true);
  });

  it('рисует таблицу настоящей <table> и сохраняет её исходник в документе', () => {
    const table = '| Кол | Знач |\n|:---|---:|\n| a | 1 |';
    view = mount(`текст\n\n${table}`, 0);
    expect(view.contentDOM.querySelector('table.md-table')).not.toBeNull();
    // Главное: под виджетом лежит исходный markdown, выравнивание никуда не делось.
    expect(view.state.doc.toString()).toBe(`текст\n\n${table}`);
  });

  it('оставляет документ ровно тем markdown-текстом, что в него положили', () => {
    const doc = '# Тест\n\n| a | b |\n|:---|---:|\n| 1 | 2 |\n\n_курсив_\n\n\\*экран\\*';
    view = mount(doc, 0);
    expect(view.state.doc.toString()).toBe(doc);
  });

  it('отдаёт Enter markdown-раскладке раньше базовой', () => {
    view = mount('- пункт', 7);
    // Порядок расширений — не украшение: возьми верх базовый keymap, он просто
    // вставил бы перевод строки и список бы оборвался. Первым Enter перехватывает
    // автодополнение (чтобы принять пункт меню «/»), но оно пропускает клавишу
    // дальше, когда меню закрыто, — значит важно, кто идёт следом.
    const enterRuns = view.state
      .facet(keymap)
      .flat()
      .filter((b) => b.key === 'Enter')
      .map((b) => b.run);
    expect(enterRuns).toContain(insertNewlineContinueMarkup);
    expect(enterRuns.indexOf(insertNewlineContinueMarkup)).toBeLessThan(
      enterRuns.indexOf(insertNewlineAndIndent),
    );
  });

  it('продолжает список по Enter', () => {
    const doc = '- пункт';
    view = mount(doc, doc.length);
    ensureSyntaxTree(view.state, doc.length, 500);
    insertNewlineContinueMarkup(view);
    expect(view.state.doc.toString()).toBe('- пункт\n- ');
  });
});

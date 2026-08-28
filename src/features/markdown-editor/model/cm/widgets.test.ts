import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Highlight } from './highlightSyntax';
import { POS_ATTR, enterBlock, toggleTask } from './widgets';

function viewFor(doc: string): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage, extensions: [Highlight] })],
    }),
  });
}

function checkboxAt(from: number): HTMLInputElement {
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.setAttribute(POS_ATTR, String(from));
  return box;
}

describe('переключение задачи', () => {
  // Состояние живёт в тексте, а не в DOM: клик правит документ, и следующая
  // отрисовка чекбокса берётся уже из него. Рассинхрону взяться неоткуда.
  it('ставит галочку правкой markdown-текста', () => {
    const view = viewFor('- [ ] купить хлеб');
    expect(toggleTask(view, checkboxAt(2))).toBe(true);
    expect(view.state.doc.toString()).toBe('- [x] купить хлеб');
  });

  it('снимает галочку обратно', () => {
    const view = viewFor('- [x] купить хлеб');
    toggleTask(view, checkboxAt(2));
    expect(view.state.doc.toString()).toBe('- [ ] купить хлеб');
  });

  it('правит нужную задачу, а не первую попавшуюся', () => {
    const view = viewFor('- [ ] раз\n- [ ] два');
    toggleTask(view, checkboxAt(12));
    expect(view.state.doc.toString()).toBe('- [ ] раз\n- [x] два');
  });

  it('не трогает документ, если под позицией уже не задача', () => {
    const view = viewFor('обычный текст');
    expect(toggleTask(view, checkboxAt(2))).toBe(false);
    expect(view.state.doc.toString()).toBe('обычный текст');
  });

  it('пропускает клики мимо чекбокса', () => {
    const view = viewFor('- [ ] дело');
    expect(toggleTask(view, document.createElement('span'))).toBe(false);
  });
});

describe('вход в блочный виджет', () => {
  it('ставит каретку в начало блока', () => {
    const view = viewFor('текст\n\n| a | b |\n|---|---|');
    const block = document.createElement('div');
    block.className = 'cm-md-block';
    block.setAttribute(POS_ATTR, '7');
    expect(enterBlock(view, block)).toBe(true);
    expect(view.state.selection.main.anchor).toBe(7);
  });

  it('не перехватывает клик по <summary> — тот раскрывает спойлер сам', () => {
    const view = viewFor('<details><summary>Тут</summary></details>');
    const block = document.createElement('div');
    block.className = 'cm-md-block';
    block.setAttribute(POS_ATTR, '0');
    const summary = document.createElement('summary');
    block.appendChild(summary);
    expect(enterBlock(view, summary)).toBe(false);
  });
});

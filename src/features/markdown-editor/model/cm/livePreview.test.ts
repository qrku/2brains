import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Highlight } from './highlightSyntax';
import { buildDecorations } from './livePreview';
import type { BlockWidget } from './widgets';

function stateFor(doc: string, cursor: number): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage, extensions: [Highlight] })],
  });
}

interface Snapshot {
  /** Текст, скрытый от глаз: маркеры разметки. */
  hidden: string[];
  /** Класс оформления → фрагменты, на которые он лёг. */
  marks: Record<string, string[]>;
  /** Классы строчных декораций. */
  lines: string[];
  /** Имена классов виджетов в порядке появления. */
  widgets: string[];
  /** Сами виджеты — чтобы проверить, какой исходник они держат. */
  raw: unknown[];
}

function snapshot(doc: string, cursor: number, focused = true): Snapshot {
  const set = buildDecorations(stateFor(doc, cursor), focused);
  const snap: Snapshot = { hidden: [], marks: {}, lines: [], widgets: [], raw: [] };
  for (const iter = set.iter(); iter.value; iter.next()) {
    const { from, to } = iter;
    const spec = iter.value.spec as { class?: string; widget?: object };
    if (spec.widget) {
      snap.widgets.push(spec.widget.constructor.name);
      snap.raw.push(spec.widget);
    } else if (spec.class && from === to) {
      snap.lines.push(spec.class);
    } else if (spec.class) {
      (snap.marks[spec.class] ??= []).push(doc.slice(from, to));
    } else if (to > from) {
      snap.hidden.push(doc.slice(from, to));
    }
  }
  return snap;
}

/** Курсор на последней строке — вся разметка выше неё отрисована. */
const away = (doc: string) => doc.length;

describe('живое превью: скрытие маркеров', () => {
  it('прячет решётки заголовка и задаёт его уровень', () => {
    const doc = '# Заголовок\n\nтекст';
    const snap = snapshot(doc, away(doc));
    expect(snap.hidden).toContain('# ');
    expect(snap.lines).toContain('cm-md-h1');
  });

  it('возвращает решётки, когда каретка на строке заголовка', () => {
    const doc = '# Заголовок\n\nтекст';
    const snap = snapshot(doc, 3);
    expect(snap.hidden).not.toContain('# ');
    // Оформление при этом остаётся — строка не «прыгает» при заходе каретки.
    expect(snap.lines).toContain('cm-md-h1');
  });

  it('прячет звёздочки жирного и помечает текст', () => {
    const doc = '**жирно**\n\nx';
    const snap = snapshot(doc, away(doc));
    expect(snap.hidden).toEqual(['**', '**']);
    expect(snap.marks['cm-md-strong']).toEqual(['**жирно**']);
  });

  it('понимает ==выделение== — синтаксис, которого нет в GFM', () => {
    const doc = '==важно==\n\nx';
    const snap = snapshot(doc, away(doc));
    expect(snap.marks['md-mark cm-md-highlight']).toEqual(['==важно==']);
    expect(snap.hidden).toEqual(['==', '==']);
  });

  it('прячет адрес ссылки, оставляя её текст', () => {
    const doc = '[тут](https://example.com)\n\nx';
    const snap = snapshot(doc, away(doc));
    expect(snap.hidden).toContain('https://example.com');
    expect(snap.hidden.join('')).not.toContain('тут');
  });

  it('прячет бэкслеш экранирования, оставляя сам символ', () => {
    const doc = '\\*не курсив\\*\n\nx';
    const snap = snapshot(doc, away(doc));
    expect(snap.hidden).toEqual(['\\', '\\']);
    expect(snap.marks['cm-md-em']).toBeUndefined();
  });

  it('приглушает ограждение блока кода, но не прячет его', () => {
    // Убрать строку из текстового документа нельзя — на её месте зияла бы пустота.
    const doc = '```js\nконст\n```\n\nx';
    const snap = snapshot(doc, away(doc));
    expect(snap.hidden).not.toContain('```');
    expect(snap.marks['cm-md-fence']).toEqual(expect.arrayContaining(['```', 'js']));
    expect(snap.lines.filter((c) => c === 'cm-md-code-block')).toHaveLength(3);
    // Крайние строки несут вертикальные поля и скругление плашки.
    expect(snap.lines).toContain('cm-md-code-first');
    expect(snap.lines).toContain('cm-md-code-last');
  });

  it('не трогает разметку внутри блока кода', () => {
    const doc = '```\n# не заголовок **и не жирный**\n```\n\nx';
    const snap = snapshot(doc, away(doc));
    expect(snap.hidden).toHaveLength(0);
    expect(snap.marks['cm-md-strong']).toBeUndefined();
  });
});

describe('живое превью: виджеты', () => {
  it('рисует чекбокс задачи и всегда держит его на виду', () => {
    const doc = '- [x] сделано';
    // Каретка прямо на строке: чекбокс — единственный способ переключить состояние.
    expect(snapshot(doc, doc.length).widgets).toContain('CheckboxWidget');
    expect(snapshot(doc, 0).widgets).toContain('CheckboxWidget');
  });

  it('заменяет буллет точкой, но оставляет номер нумерованного списка', () => {
    expect(snapshot('- пункт\n\nx', away('- пункт\n\nx')).widgets).toContain('BulletWidget');
    const ordered = snapshot('1. пункт\n\nx', away('1. пункт\n\nx'));
    expect(ordered.widgets).not.toContain('BulletWidget');
    expect(ordered.marks['cm-md-listmark']).toEqual(['1.']);
  });

  it('рисует разделитель линией', () => {
    const doc = '---\n\nx';
    expect(snapshot(doc, away(doc)).widgets).toContain('RuleWidget');
  });

  it('показывает картинку и убирает её разметку', () => {
    const doc = '![кот](https://example.com/cat.png)\n\nx';
    const snap = snapshot(doc, away(doc));
    expect(snap.widgets).toContain('ImageWidget');
    expect(snap.raw[0]).toMatchObject({ url: 'https://example.com/cat.png', alt: 'кот' });
  });
});

describe('живое превью: блоки целиком', () => {
  const TABLE = '| Кол | Знач |\n|:---|---:|\n| a | 1 |';

  it('рисует таблицу и держит её исходник дословно', () => {
    const doc = `${TABLE}\n\nx`;
    const snap = snapshot(doc, away(doc));
    expect(snap.widgets).toEqual(['BlockWidget']);
    // Главное: выравнивание `:---` и `---:` доезжает до виджета нетронутым.
    // Прежний путь через htmlToMarkdown схлопывал его в `---` на первом же сохранении.
    expect((snap.raw[0] as BlockWidget).source).toBe(TABLE);
  });

  it('показывает исходник таблицы, когда каретка внутри неё', () => {
    const snap = snapshot(`${TABLE}\n\nx`, 3);
    expect(snap.widgets).toHaveLength(0);
    expect(snap.lines.filter((c) => c === 'cm-md-table-src')).toHaveLength(3);
  });

  it('рисует <details>, но не любой другой HTML-блок', () => {
    const details = '<details>\n<summary>Тут</summary>\n\nтекст\n\n</details>';
    expect(snapshot(`${details}\n\nx`, away(`${details}\n\nx`)).widgets).toEqual(['BlockWidget']);

    const plain = '<div>сырой html</div>';
    expect(snapshot(`${plain}\n\nx`, away(`${plain}\n\nx`)).widgets).toHaveLength(0);
  });
});

describe('живое превью: текст неприкосновенен', () => {
  // Конструкции, которые прежний путь markdown → HTML → markdown портил молча.
  // Здесь портить нечего: документ и есть markdown, а превью — только декорации
  // поверх него. Тест сторожит именно это свойство архитектуры.
  const CORPUS = [
    '| a | b |\n|:---|---:|\n| 1 | 2 |', // выравнивание таблицы
    '_курсив_ и *курсив*', // стиль подчёркиваний
    '1. раз\n1. два\n1. три', // авторская нумерация
    'строка с двумя пробелами  \nперенос', // жёсткий перенос
    '\\*экранированная звёздочка\\*',
    '---\ntitle: frontmatter\n---\n\nтекст',
    '+ плюс\n* звёздочка\n- дефис',
    '[ссылка][1]\n\n[1]: https://example.com',
  ];

  it.each(CORPUS)('оставляет документ буква в букву: %s', (doc) => {
    const state = stateFor(doc, 0);
    buildDecorations(state, true);
    expect(state.doc.toString()).toBe(doc);
  });
});

describe('живое превью: фокус', () => {
  // Каретка по умолчанию стоит в позиции 0. Без оглядки на фокус только что
  // открытый файл встречал пользователя сырой первой строкой: «# Заголовок».
  it('не раскрывает разметку, пока редактор не в фокусе', () => {
    const doc = '# Заголовок\n\n**жирно**';
    const blurred = snapshot(doc, 0, false);
    expect(blurred.hidden).toContain('# ');
    expect(blurred.lines).toContain('cm-md-h1');
  });

  it('раскрывает строку под кареткой, как только фокус появился', () => {
    const doc = '# Заголовок\n\n**жирно**';
    expect(snapshot(doc, 0, true).hidden).not.toContain('# ');
  });
});

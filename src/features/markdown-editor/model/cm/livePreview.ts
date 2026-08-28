import {
  StateEffect,
  StateField,
  type Extension,
  type EditorState,
  type Range,
} from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { SyntaxNodeRef } from '@lezer/common';
import { BlockWidget, BulletWidget, CheckboxWidget, ImageWidget, RuleWidget } from './widgets';

/**
 * Живое превью в духе Obsidian.
 *
 * Ключевое свойство: документ — это markdown-текст и ничего больше. Всё, что видит
 * пользователь, — декорации поверх него: маркеры разметки прячутся, стиль
 * накладывается, но под ними лежат ровно те символы, что уйдут на диск. Обратного
 * преобразования (HTML → markdown) не существует, поэтому терять на нём нечего:
 * ни выравнивания таблиц, ни экранирования, ни стиля списков.
 *
 * Разметка проявляется обратно, когда каретка попадает на её строку — так же, как
 * в Obsidian. Гранулярность именно построчная: она предсказуема и не «мигает»
 * при движении курсора внутри абзаца.
 */

const hidden = Decoration.replace({});

/* ─── Фокус ───────────────────────────────────────────────────────────────── */

/**
 * Раскрывать разметку под кареткой имеет смысл, только пока в редакторе печатают.
 * Без этого только что открытый файл показывал первую строку сырой: каретка по
 * умолчанию стоит в позиции 0, и заголовок встречал пользователя решёткой.
 */
const setFocused = StateEffect.define<boolean>();

const focusedField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setFocused)) return effect.value;
    return value;
  },
});

const trackFocus = EditorView.focusChangeEffect.of((_state, focusing) => setFocused.of(focusing));

/* ─── Стилевые классы (определены в ./theme) ──────────────────────────────── */
const line = (cls: string) => Decoration.line({ class: cls });
const mark = (cls: string) => Decoration.mark({ class: cls });

const MARKS: Record<string, string> = {
  StrongEmphasis: 'cm-md-strong',
  Emphasis: 'cm-md-em',
  Strikethrough: 'cm-md-strike',
  Highlight: 'md-mark cm-md-highlight',
  InlineCode: 'md-code cm-md-inline-code',
  Link: 'cm-md-link',
  Autolink: 'cm-md-link',
};

/** Маркеры парного инлайнового форматирования: прячутся, пока строка неактивна. */
const INLINE_MARKS = new Set(['EmphasisMark', 'StrikethroughMark', 'HighlightMark', 'LinkMark']);

/* ─── Активные строки ─────────────────────────────────────────────────────── */

/** Номера строк, которых касается выделение, — на них разметка показывается сырой. */
function activeLines(state: EditorState, focused: boolean): Set<number> {
  const lines = new Set<number>();
  // Редактор не в фокусе — показываем документ целиком отрисованным.
  if (!focused) return lines;
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

/* ─── Сборка декораций ────────────────────────────────────────────────────── */

export function buildDecorations(state: EditorState, focused: boolean): DecorationSet {
  const { doc } = state;
  const active = activeLines(state, focused);
  const ranges: Range<Decoration>[] = [];

  const lineActive = (pos: number) => active.has(doc.lineAt(pos).number);
  const spanActive = (from: number, to: number) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let n = first; n <= last; n++) if (active.has(n)) return true;
    return false;
  };

  /** Класс на каждую строку блока — фон кода, полоска цитаты и т.п. */
  const decorateLines = (from: number, to: number, cls: string) => {
    for (let pos = from; ;) {
      const ln = doc.lineAt(pos);
      ranges.push(line(cls).range(ln.from));
      if (ln.to >= to) break;
      pos = ln.to + 1;
    }
  };

  /** Прячет маркер вместе со следующим за ним пробелом — иначе остаётся отступ. */
  const hideWithSpace = (from: number, to: number) => {
    const end = doc.sliceString(to, to + 1) === ' ' ? to + 1 : to;
    ranges.push(hidden.range(from, end));
  };

  // Дерево может быть ещё не разобрано на момент первой отрисовки — тогда декорации
  // не появились бы вовсе до первого нажатия клавиши. Ждём разбор явно.
  const tree = ensureSyntaxTree(state, doc.length, 500) ?? syntaxTree(state);

  tree.iterate({
    enter: (node: SyntaxNodeRef): boolean | void => {
      const { name, from, to } = node;

      /* ── Блоки, которые имеют смысл только целиком ── */
      if (name === 'Table' || name === 'HTMLBlock') {
        const source = doc.sliceString(from, to);
        // HTML-блок рисуем, только если это <details>: остальное — сырой HTML,
        // и подменять его на рендер было бы неожиданно.
        const renderable = name === 'Table' || /^<details[\s>]/i.test(source.trimStart());
        if (renderable && !spanActive(from, to)) {
          ranges.push(
            Decoration.replace({ widget: new BlockWidget(source, from), block: true }).range(
              from,
              to,
            ),
          );
          return false; // содержимое заменено целиком — внутрь не идём
        }
        decorateLines(from, to, name === 'Table' ? 'cm-md-table-src' : 'cm-md-html');
        return;
      }

      /* ── Заголовки ── */
      const atx = /^ATXHeading(\d)$/.exec(name);
      if (atx) {
        decorateLines(from, to, `cm-md-h${atx[1]}`);
        return;
      }
      if (/^SetextHeading[12]$/.test(name)) {
        decorateLines(from, to, `cm-md-h${name.endsWith('1') ? 1 : 2}`);
        return;
      }
      if (name === 'HeaderMark') {
        // У setext-заголовка маркер — это целая строка `===`; спрятав её,
        // мы оставили бы пустую строку вместо подчёркивания.
        if (node.node.parent?.name.startsWith('ATXHeading') && !lineActive(from)) {
          hideWithSpace(from, to);
        }
        return;
      }

      /* ── Цитата ── */
      if (name === 'Blockquote') {
        decorateLines(from, to, 'cm-md-quote');
        return;
      }
      if (name === 'QuoteMark') {
        if (!lineActive(from)) hideWithSpace(from, to);
        return;
      }

      /* ── Списки и задачи ── */
      if (name === 'ListItem') {
        decorateLines(from, to, 'cm-md-li');
        return;
      }
      if (name === 'ListMark') {
        const parent = node.node.parent;
        // У задачи маркер списка лишний — его роль играет чекбокс.
        if (parent?.getChild('Task')) {
          if (!lineActive(from)) hideWithSpace(from, to);
          return;
        }
        const ordered = parent?.parent?.name === 'OrderedList';
        // Номер несёт смысл и остаётся виден; буллет заменяем на аккуратную точку.
        if (ordered || lineActive(from)) ranges.push(mark('cm-md-listmark').range(from, to));
        else ranges.push(Decoration.replace({ widget: new BulletWidget() }).range(from, to));
        return;
      }
      if (name === 'TaskMarker') {
        // Чекбокс показываем всегда: он и есть способ переключить состояние,
        // а исходный `[x]` остаётся в тексте под ним.
        const checked = doc.sliceString(from, to) !== '[ ]';
        ranges.push(
          Decoration.replace({ widget: new CheckboxWidget(checked, from) }).range(from, to),
        );
        return false;
      }

      /* ── Код ── */
      if (name === 'FencedCode' || name === 'CodeBlock') {
        decorateLines(from, to, 'cm-md-code-block');
        // Плашка кода собирается из отдельных строк, поэтому вертикальные поля и
        // скругление вешаются на крайние строки — иначе текст упирается в край.
        ranges.push(line('cm-md-code-first').range(doc.lineAt(from).from));
        ranges.push(line('cm-md-code-last').range(doc.lineAt(to).from));
        return;
      }
      if (name === 'CodeInfo') {
        ranges.push(mark('cm-md-fence').range(from, to));
        return;
      }
      if (name === 'CodeMark') {
        const parent = node.node.parent?.name;
        // Ограждение блока не прячем: убрать строку из текстового документа нельзя,
        // и на её месте зияла бы пустота. Вместо этого приглушаем.
        if (parent === 'FencedCode') ranges.push(mark('cm-md-fence').range(from, to));
        else if (!lineActive(from)) ranges.push(hidden.range(from, to));
        return;
      }

      /* ── Разделитель ── */
      if (name === 'HorizontalRule') {
        if (lineActive(from)) decorateLines(from, to, 'cm-md-hr-src');
        else ranges.push(Decoration.replace({ widget: new RuleWidget() }).range(from, to));
        return;
      }

      /* ── Изображение ── */
      if (name === 'Image') {
        if (lineActive(from)) return;
        const source = doc.sliceString(from, to);
        const m = /^!\[([^\]]*)\]\(\s*([^)\s]*)/.exec(source);
        if (!m || !m[2]) return;
        ranges.push(Decoration.replace({ widget: new ImageWidget(m[2], m[1]) }).range(from, to));
        return false;
      }

      /* ── Инлайновое форматирование ── */
      const cls = MARKS[name];
      if (cls) {
        ranges.push(mark(cls).range(from, to));
        return;
      }
      if (INLINE_MARKS.has(name)) {
        if (!lineActive(from)) ranges.push(hidden.range(from, to));
        return;
      }
      if (name === 'URL' || name === 'LinkTitle') {
        // Внутри Autolink URL — это и есть весь видимый текст, прятать нечего.
        const parent = node.node.parent?.name;
        if ((parent === 'Link' || parent === 'Image') && !lineActive(from)) {
          ranges.push(hidden.range(from, to));
        }
        return;
      }
      if (name === 'Escape') {
        // `\*` — показываем звёздочку, прячем сам бэкслеш.
        if (!lineActive(from)) ranges.push(hidden.range(from, from + 1));
        return;
      }
    },
  });

  return Decoration.set(ranges, true);
}

/* ─── Поле состояния ──────────────────────────────────────────────────────── */

const decorations = StateField.define<DecorationSet>({
  create: (state) => buildDecorations(state, state.field(focusedField)),
  update(deco, tr) {
    // Пересобираем на правку, на движение каретки и на смену фокуса — от всех
    // трёх зависит, какие строки показаны сырыми.
    const refocused = tr.effects.some((e) => e.is(setFocused));
    if (tr.docChanged || tr.selection || refocused) {
      return buildDecorations(tr.state, tr.state.field(focusedField));
    }
    return deco.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Поле фокуса идёт первым: декорации читают его уже при начальной сборке. */
export const livePreview: Extension = [focusedField, trackFocus, decorations];

import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const MONO = "'SF Mono', 'Fira Code', 'Fira Mono', 'Cascadia Code', monospace";

/**
 * Оформление редактора.
 *
 * Значения намеренно повторяют глобальные `.md-*` из globals.css: превью (NoteAside,
 * сообщения агента) и редактор должны выглядеть одинаково, иначе текст «прыгает»
 * при переходе между ними. Всё живёт в теме CodeMirror, а не в CSS-модуле, потому
 * что декорации оперируют настоящими именами классов, а модуль их хеширует.
 */
export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    // Та же переменная, что у `.md-p` в globals.css — см. её комментарий: на
    // мобильных она поднимается до 16 px, иначе iOS увеличивает страницу, стоит
    // поставить каретку в текст.
    fontSize: 'var(--md-text, 14px)',
    color: 'var(--text-2)',
    backgroundColor: 'var(--paper)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: '1.8',
    overflowY: 'auto',
  },
  // Колонка текста центрируется паддингами, а не шириной: `.cm-content` живёт во
  // flex-скроллере с flex-grow: 2, и свободное место по спецификации достаётся
  // росту раньше, чем авто-полям — `width` + `margin: 0 auto` там не центрируют.
  // Заодно поле остаётся во всю ширину панели, поэтому клик слева или справа от
  // текста попадает в редактор, а не мимо него.
  // Минимум боковых полей — переменная из globals.css: на телефоне фиксированные
  // 40 px с каждой стороны съедали бы четверть строки.
  '.cm-content': {
    padding: '28px max(var(--editor-pad-x, 40px), (100% - var(--preview-width, 70%)) / 2) 140px',
    caretColor: 'var(--ink)',
  },
  '.cm-line': { padding: '0' },
  '&.cm-editor .cm-cursor': { borderLeftColor: 'var(--ink)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--highlight)',
  },
  '.cm-placeholder': { color: 'var(--text-5)' },

  /* ── Заголовки ── */
  '.cm-md-h1': {
    fontSize: '28px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
    lineHeight: '1.2',
    color: 'var(--ink)',
  },
  '.cm-md-h2': {
    fontSize: '22px',
    fontWeight: '600',
    letterSpacing: '-0.3px',
    lineHeight: '1.35',
    color: 'var(--ink)',
  },
  '.cm-md-h3': { fontSize: '18px', fontWeight: '600', lineHeight: '1.45', color: 'var(--ink)' },
  '.cm-md-h4': { fontSize: '15px', fontWeight: '600', lineHeight: '1.5', color: 'var(--ink)' },
  '.cm-md-h5': {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-2)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  '.cm-md-h6': {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-4)',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },

  /* ── Инлайн ── */
  '.cm-md-strong': { fontWeight: '700', color: 'var(--ink)' },
  '.cm-md-em': { fontStyle: 'italic' },
  '.cm-md-strike': { textDecoration: 'line-through', color: 'var(--text-4)' },
  '.cm-md-highlight': { borderRadius: '2px', padding: '0 3px' },
  '.cm-md-inline-code': { fontFamily: MONO, fontSize: '12px' },
  '.cm-md-link': {
    color: 'var(--ink)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },

  /* ── Списки ── */
  '.cm-md-li': { paddingLeft: '22px', textIndent: '-22px' },
  '.cm-md-listmark': { color: 'var(--text-4)' },
  '.cm-md-bullet': { color: 'var(--text-4)', paddingRight: '7px' },
  '.cm-md-checkbox': { verticalAlign: '-2px', cursor: 'pointer' },

  /* ── Цитата ── */
  '.cm-md-quote': {
    borderLeft: '3px solid var(--border-2)',
    paddingLeft: '16px',
    color: 'var(--text-4)',
  },

  /* ── Код ── */
  '.cm-md-code-block': {
    fontFamily: MONO,
    fontSize: '12.5px',
    lineHeight: '1.75',
    backgroundColor: 'var(--bg-2)',
    color: 'var(--text-2)',
    padding: '0 18px',
  },
  // Ограждение остаётся кодового размера: уменьшенный шрифт читался как сбой
  // вёрстки, а не как приглушение. Цвет — на ступень темнее самого блёклого,
  // на --text-5 бэктики почти пропадали с фона плашки.
  '.cm-md-fence': { color: 'var(--text-4)' },
  // Идут после `.cm-md-code-block`: та задаёт padding сокращённой записью и
  // обнулила бы вертикальные поля, объяви мы их раньше.
  '.cm-md-code-first': { paddingTop: '12px', borderRadius: '3px 3px 0 0' },
  '.cm-md-code-last': { paddingBottom: '12px', borderRadius: '0 0 3px 3px' },

  /* ── Разделитель ── */
  '.cm-md-rule': {
    display: 'inline-block',
    width: '100%',
    verticalAlign: 'middle',
    borderTop: '1px solid var(--border-2)',
  },
  '.cm-md-hr-src': { color: 'var(--text-5)' },

  /* ── Сырой источник таблицы и HTML ── */
  '.cm-md-table-src, .cm-md-html': {
    fontFamily: MONO,
    fontSize: '12.5px',
    color: 'var(--text-3)',
  },

  /* ── Блочные виджеты ── */
  '.cm-md-block': { cursor: 'pointer', margin: '4px 0' },
  '.cm-md-image img': { maxWidth: '100%', borderRadius: '3px', margin: '8px 0' },

  /* ── Меню «/» ── */
  '.cm-tooltip.cm-tooltip-autocomplete': {
    border: '1px solid var(--border-2)',
    borderRadius: '6px',
    background: 'var(--paper)',
    boxShadow: '0 8px 28px rgba(0, 0, 0, 0.14)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'inherit',
    fontSize: '13px',
    maxHeight: '340px',
    minWidth: '230px',
  },
  '.cm-tooltip-autocomplete > ul > li': {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '6px 12px',
    color: 'var(--text-2)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    background: 'var(--bg-2)',
    color: 'var(--ink)',
  },
  '.cm-tooltip-autocomplete > ul > completion-section': {
    padding: '7px 12px 3px',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    color: 'var(--text-5)',
    borderTop: '1px solid var(--border-3)',
  },
  '.cm-tooltip-autocomplete > ul > completion-section:first-child': { borderTop: 'none' },
  '.cm-slash-icon': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    flexShrink: '0',
    fontSize: '11px',
    color: 'var(--text-4)',
  },
});

/**
 * Подсветка того, что декорации не покрывают: содержимое блоков кода. Остальная
 * разметка оформлена классами из `livePreview` — там видно, где именно скрыт маркер.
 */
export const editorHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: 'var(--ink)', fontWeight: '600' },
    { tag: [tags.string, tags.special(tags.string)], color: 'var(--text-3)' },
    { tag: [tags.comment], color: 'var(--text-5)', fontStyle: 'italic' },
    { tag: [tags.number, tags.bool, tags.null], color: 'var(--text-3)' },
    { tag: [tags.typeName, tags.className], color: 'var(--ink)' },
  ]),
);

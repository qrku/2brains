import { WidgetType, type EditorView } from '@codemirror/view';
import { parseMarkdown } from '@/shared/lib/markdown';
import { safeUrl } from '@/shared/lib/safeUrl';

/**
 * Виджеты живого превью.
 *
 * Все они — «нарисованное поверх», а не содержимое документа: под каждым лежит
 * исходный markdown, и стоит каретке попасть на его строку, декорация снимается
 * и текст показывается как есть. Поэтому виджет никогда не участвует в сохранении
 * и не может ничего потерять — сериализатора в этой архитектуре нет вовсе.
 */

/** Позиция исходного текста под виджетом — по ней обработчики правят документ. */
export const POS_ATTR = 'data-md-from';

/* ─── Чекбокс задачи ──────────────────────────────────────────────────────── */
export class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
  ) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.from === this.from;
  }

  toDOM(): HTMLElement {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'md-checkbox cm-md-checkbox';
    box.checked = this.checked;
    box.setAttribute(POS_ATTR, String(this.from));
    return box;
  }

  /** Клик должен дойти до нашего обработчика, а не быть съеден редактором. */
  ignoreEvent(): boolean {
    return false;
  }
}

/* ─── Маркер списка ───────────────────────────────────────────────────────── */
export class BulletWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const dot = document.createElement('span');
    dot.className = 'cm-md-bullet';
    dot.textContent = '•';
    return dot;
  }
}

/* ─── Горизонтальная линия ────────────────────────────────────────────────── */
export class RuleWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const rule = document.createElement('span');
    rule.className = 'cm-md-rule';
    return rule;
  }
}

/* ─── Изображение ─────────────────────────────────────────────────────────── */
export class ImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return other.url === this.url && other.alt === this.alt;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-md-image';
    const img = document.createElement('img');
    // Та же фильтрация схем, что и в parseMarkdown: javascript:-ссылка не должна
    // становиться картинкой только потому, что её отрисовал редактор, а не превью.
    img.src = safeUrl(this.url, '');
    img.alt = this.alt;
    img.className = 'md-img';
    img.loading = 'lazy';
    wrap.appendChild(img);
    return wrap;
  }
}

/* ─── Блочный HTML: таблица и <details> ───────────────────────────────────── */

/**
 * Блок, который осмысленно показывать только целиком (таблица, спойлер).
 *
 * Рисуется через `parseMarkdown` — тот же код, что уже отвечает за превью в
 * NoteAside и сообщениях агента, вместе с его экранированием и `.md-*` стилями.
 * Клик по виджету ставит каретку в начало блока: так пользователь попадает
 * в исходник и правит текст напрямую.
 */
export class BlockWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly from: number,
  ) {
    super();
  }

  eq(other: BlockWidget): boolean {
    return other.source === this.source && other.from === this.from;
  }

  toDOM(): HTMLElement {
    const host = document.createElement('div');
    host.className = 'cm-md-block';
    host.setAttribute(POS_ATTR, String(this.from));
    // parseMarkdown экранирует HTML и фильтрует схемы ссылок — см. его тесты.
    host.innerHTML = parseMarkdown(this.source);
    return host;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/* ─── Обработчики кликов по виджетам ──────────────────────────────────────── */

/** Ближайший предок с записанной позицией в документе. */
function widgetPos(target: EventTarget | null): { el: HTMLElement; from: number } | null {
  const el = (target as HTMLElement | null)?.closest?.(`[${POS_ATTR}]`) as HTMLElement | null;
  if (!el) return null;
  const from = Number(el.getAttribute(POS_ATTR));
  return Number.isFinite(from) ? { el, from } : null;
}

/** Переключает `- [ ]` ↔ `- [x]` правкой документа, а не состоянием DOM. */
export function toggleTask(view: EditorView, target: EventTarget | null): boolean {
  const hit = widgetPos(target);
  if (!hit || !(hit.el instanceof HTMLInputElement)) return false;
  const current = view.state.doc.sliceString(hit.from, hit.from + 3);
  if (!/^\[[ xX]\]$/.test(current)) return false;
  view.dispatch({
    changes: { from: hit.from, to: hit.from + 3, insert: current === '[ ]' ? '[x]' : '[ ]' },
  });
  return true;
}

/** Клик по блочному виджету — вход в исходник этого блока. */
export function enterBlock(view: EditorView, target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  // <summary> раскрывает спойлер сам; перехват сорвал бы его штатное поведение.
  if (el?.closest('summary')) return false;
  const hit = widgetPos(target);
  if (!hit || !hit.el.classList.contains('cm-md-block')) return false;
  view.dispatch({ selection: { anchor: hit.from }, scrollIntoView: true });
  view.focus();
  return true;
}

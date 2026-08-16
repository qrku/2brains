/* ─── Code-block editing helpers ──────────────────────────────────────────── */
/** Nearest ancestor with the given lowercase tag, searching up to (not including) `root`. */
export function closestTag(node: Node | null, tag: string, root: Node): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName.toLowerCase() === tag) {
      return n as HTMLElement;
    }
    n = n.parentNode;
  }
  return null;
}

/** Drop `text` in at the caret as a single text node and leave the caret right after it. */
export function insertTextAtCaret(text: string): void {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const tn = document.createTextNode(text);
  range.insertNode(tn);
  range.setStartAfter(tn);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ─── Ensure visual editor always ends with an editable paragraph ─────────── */
export function ensureTrailingP(el: HTMLElement) {
  const last = el.lastElementChild;
  // Already ends with a plain paragraph — nothing to do
  if (last?.tagName === 'P') return;
  el.appendChild(emptyP());
}

export function emptyP(): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'md-p';
  p.innerHTML = '<br>';
  return p;
}

/**
 * Пустой абзац в самом конце документа — «место, куда выйти» из последнего блока.
 * В отличие от `ensureTrailingP` не считает подходящим абзац с текстом.
 */
export function trailingEmptyP(el: HTMLElement): HTMLElement {
  const last = el.lastElementChild as HTMLElement | null;
  if (last?.tagName === 'P' && !(last.textContent ?? '').trim()) return last;
  const p = emptyP();
  el.appendChild(p);
  return p;
}

/** Прямой потомок редактора, внутри которого лежит `node`. */
export function topBlock(node: Node | null, editor: Node): HTMLElement | null {
  let n: Node | null = node;
  while (n && n.parentNode !== editor) n = n.parentNode;
  return n?.nodeType === Node.ELEMENT_NODE ? (n as HTMLElement) : null;
}

/** Ставит каретку в начало блока (в первый текстовый узел, если он есть). */
export function caretToBlockStart(block: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const first = walker.nextNode() as Text | null;
  const r = document.createRange();
  if (first) r.setStart(first, 0);
  else r.setStart(block, 0);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

/* ─── Inline formatting ───────────────────────────────────────────────────── */
export const INLINE_FORMAT_TAGS = 'mark, strong, b, em, i, del, s, u, code';
/** Zero-width space: держит каретку снаружи <mark>, из markdown вычищается. */
export const ZWSP = '\u200B';

/** Ближайшая обёртка форматирования вокруг каретки (не считая кода внутри <pre>). */
export function closestInlineFormat(node: Node | null, root: Node): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement;
      if (el.matches(INLINE_FORMAT_TAGS)) {
        return closestTag(el, 'pre', root) ? null : el;
      }
      if (el.tagName.toLowerCase() === 'pre') return null;
    }
    n = n.parentNode;
  }
  return null;
}

/**
 * Удаляет пустые обёртки форматирования. Браузер копирует `<mark>` (и подобные)
 * в новый блок при Enter, поэтому «выделение» продолжало действовать на новой
 * строке, хотя текста в нём нет. Возвращает true, если DOM изменился.
 */
export function dropEmptyFormatting(editor: HTMLElement): boolean {
  const sel = window.getSelection();
  const caret = sel?.rangeCount ? sel.getRangeAt(0).startContainer : null;
  let changed = false;

  for (const el of Array.from(editor.querySelectorAll<HTMLElement>(INLINE_FORMAT_TAGS))) {
    if (!editor.contains(el)) continue; // уже удалён вместе с родителем
    if (closestTag(el, 'pre', editor)) continue;
    if ((el.textContent ?? '').replace(/\u200B/g, '').trim() !== '') continue;
    if (el.querySelector('img, input')) continue; // текста нет, но содержимое есть

    const block = el.parentElement;
    const hadCaret = !!caret && el.contains(caret);
    el.remove();
    changed = true;

    if (hadCaret && block) {
      if (!block.firstChild) block.appendChild(document.createElement('br'));
      caretToBlockStart(block);
    }
  }
  return changed;
}

/** Абзацы, созданные браузером, приходят без наших классов — иначе стиль «плывёт». */
export function normalizeBlocks(editor: HTMLElement): void {
  for (const child of Array.from(editor.children)) {
    if (child.tagName === 'P' && !child.classList.contains('md-p')) child.classList.add('md-p');
  }
}

/** В `parseMarkdown` чекбоксы отключены (превью только на чтение) — здесь они кликабельны. */
export function activateCheckboxes(root: ParentNode): void {
  root.querySelectorAll('input.md-checkbox').forEach((cb) => {
    cb.removeAttribute('disabled');
    cb.setAttribute('contenteditable', 'false');
  });
}

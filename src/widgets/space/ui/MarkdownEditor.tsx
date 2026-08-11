'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSpaceStore, spaceReadContent, spaceSaveContent } from '@/entities/space';
import { useWorkspaceStore } from '@/entities/workspace';
import { parseMarkdown } from '@/shared/lib/markdown';
import { htmlToMarkdown } from '@/shared/lib/htmlToMarkdown';
import { Icon, type IconName } from '@/shared/ui/Icon';

/* ─── Slash commands ──────────────────────────────────────────────────────── */
interface Cmd {
  id: string;
  icon: string;
  svgIcon?: IconName; // when set, renders in place of the text glyph in `icon`
  label: string;
  group: string;
  snippet: string;      // '|' = cursor position (MD mode)
  visual: string;       // markdown to render in visual mode
  search?: string;      // extra search aliases (English keywords etc.)
}

const CMDS: Cmd[] = [
  { id: 'h1',     icon: 'H1', group: 'Заголовки', label: 'Заголовок 1',   snippet: '# |',                                                          visual: '# Заголовок'                                                      },
  { id: 'h2',     icon: 'H2', group: 'Заголовки', label: 'Заголовок 2',   snippet: '## |',                                                         visual: '## Заголовок'                                                     },
  { id: 'h3',     icon: 'H3', group: 'Заголовки', label: 'Заголовок 3',   snippet: '### |',                                                        visual: '### Заголовок'                                                    },
  { id: 'h4',     icon: 'H4', group: 'Заголовки', label: 'Заголовок 4',   snippet: '#### |',                                                       visual: '#### Заголовок'                                                   },
  { id: 'ul',     icon: '•',  svgIcon: 'list',       group: 'Списки',    label: 'Маркированный', snippet: '- |',                                                          visual: '- Элемент'                                                        },
  { id: 'ol',     icon: '1.', group: 'Списки',    label: 'Нумерованный',  snippet: '1. |',                                                         visual: '1. Элемент'                                                       },
  { id: 'todo',   icon: '☐',  svgIcon: 'list-check', group: 'Списки',    label: 'Задача',        snippet: '- [ ] |',                                                      visual: '- [ ] Задача'                                                     },
  { id: 'quote',  icon: '❝',  group: 'Блоки',     label: 'Цитата',        snippet: '> |',                                                          visual: '> Цитата'                                                         },
  { id: 'code',   icon: '<>', group: 'Блоки',     label: 'Блок кода',     snippet: '```\n|\n```',                                                  visual: '```\nКод\n```'                                                    },
  { id: 'detail', icon: '▸',  svgIcon: 'chevron-down', group: 'Блоки',     label: 'Детали / Спойлер', snippet: '<details>\n<summary>|</summary>\n\n\n</details>',          visual: '<details>\n<summary>Заголовок</summary>\n\nСодержание\n\n</details>', search: 'details detail spoiler спойлер' },
  { id: 'hr',     icon: '—',  group: 'Блоки',     label: 'Разделитель',   snippet: '\n---\n|',                                                     visual: '---'                                                              },
  { id: 'table',  icon: '⊞',  svgIcon: 'grid',       group: 'Блоки',     label: 'Таблица',       snippet: '| Кол 1 | Кол 2 |\n|---|---|\n| | |',                         visual: '| Кол 1 | Кол 2 |\n|---|---|\n| Ячейка | Ячейка |'             },
  { id: 'bold',   icon: 'B',  svgIcon: 'format-bold', group: 'Формат',    label: 'Жирный',        snippet: '**|**',                                                        visual: '**жирный**'                                                       },
  { id: 'italic', icon: 'I',  group: 'Формат',    label: 'Курсив',        snippet: '*|*',                                                          visual: '*курсив*'                                                         },
  { id: 'strike', icon: 'S',  group: 'Формат',    label: 'Зачёркнутый',  snippet: '~~|~~',                                                        visual: '~~зачёркнутый~~'                                                  },
  { id: 'icode',  icon: '`',  group: 'Формат',    label: 'Код в строке',  snippet: '`|`',                                                          visual: '`код`'                                                            },
  { id: 'mark',   icon: '=',  group: 'Формат',    label: 'Выделение',     snippet: '==|==',                                                        visual: '==выделение=='                                                    },
];

/* ─── Code-block editing helpers ──────────────────────────────────────────── */
/** Nearest ancestor with the given lowercase tag, searching up to (not including) `root`. */
function closestTag(node: Node | null, tag: string, root: Node): HTMLElement | null {
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
function insertTextAtCaret(text: string): void {
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
function ensureTrailingP(el: HTMLDivElement) {
  const last = el.lastElementChild;
  // Already ends with a plain paragraph — nothing to do
  if (last?.tagName === 'P') return;
  const p = document.createElement('p');
  p.className = 'md-p';
  p.innerHTML = '<br>';
  el.appendChild(p);
}

/* ─── Textarea caret coords (mirror-div) ──────────────────────────────────── */
function taCaretCoords(ta: HTMLTextAreaElement, pos: number): { top: number; left: number } {
  const div = document.createElement('div');
  const cs  = window.getComputedStyle(ta);
  (['fontFamily','fontSize','fontWeight','letterSpacing','lineHeight',
    'paddingTop','paddingLeft','paddingRight','paddingBottom',
    'borderTopWidth','borderLeftWidth','boxSizing','width',
    'whiteSpace','wordWrap','overflowWrap'] as const)
    .forEach((p) => { (div.style as any)[p] = (cs as any)[p]; });
  div.style.position = 'fixed'; div.style.visibility = 'hidden';
  div.style.top = '0'; div.style.left = '0';
  div.style.height = 'auto'; div.style.overflow = 'hidden';
  div.textContent = ta.value.slice(0, pos);
  const span = document.createElement('span');
  span.textContent = ta.value[pos] ?? '​';
  div.appendChild(span);
  document.body.appendChild(div);
  const rect = ta.getBoundingClientRect();
  const res = {
    top:  rect.top  + span.offsetTop  - ta.scrollTop  + span.offsetHeight + 4,
    left: rect.left + span.offsetLeft - ta.scrollLeft,
  };
  document.body.removeChild(div);
  return res;
}

/* ─── Preview width preference (visual mode) ──────────────────────────────── */
const PREVIEW_WIDTH_KEY = 'space_editor_preview_width';
const DEFAULT_PREVIEW_WIDTH = 70;

/* ─── Types ────────────────────────────────────────────────────────────────── */
type Mode = 'md' | 'visual';

interface SlashState {
  query: string;
  top: number;
  left: number;
  // MD mode
  mdStart?: number;
  // Visual mode
  node?: Node;
  nodeOffset?: number;
}

/* ─── Component ────────────────────────────────────────────────────────────── */
export function MarkdownEditor() {
  const { state }             = useSpaceStore();
  const { openFileId, nodes } = state;
  const { state: wsState }    = useWorkspaceStore();

  const [mode,     setMode]     = useState<Mode>('visual');
  const [content,  setContent]  = useState('');
  const [saved,    setSaved]    = useState(true);
  const [slash,    setSlash]    = useState<SlashState | null>(null);
  const [slashIdx, setSlashIdx] = useState(0);
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH);

  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Содержимое, ожидающее записи по таймеру автосейва — досохраняется при размонтировании. */
  const pendingContent = useRef<string | null>(null);
  const currentFileId = useRef<string | null>(null);
  // The workspace the currently-loaded file belongs to — kept separate from
  // wsState.currentId so a flush-on-switch always writes back to the right workspace.
  const currentFileWsId = useRef<string>(wsState.currentId);
  const taRef         = useRef<HTMLTextAreaElement>(null);
  const visualRef     = useRef<HTMLDivElement>(null);
  // Always-current ref so file-load effect can read mode without stale closure
  const modeRef       = useRef<Mode>('visual');
  useEffect(() => { modeRef.current = mode; });

  // Increments every time a different file is opened — used to trigger visual refresh
  const [fileKey, setFileKey] = useState(0);

  // Дерево, каким оно было на последнем рендере: flush'ам нужно проверить, что файл
  // ещё существует, а они срабатывают из эффектов, где замыкание уже устарело бы.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  /** Файл удалили — писать его содержимое обратно нельзя, ключ создастся заново. */
  const fileStillExists = useCallback((id: string) => nodesRef.current.some((n) => n.id === id), []);

  const openNode = openFileId ? nodes.find((n) => n.id === openFileId) : null;

  /* ── Load saved preview width preference ──────────────────────────── */
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(PREVIEW_WIDTH_KEY));
      if (saved) setPreviewWidth(saved);
    } catch {}
  }, []);

  const handlePreviewWidthChange = (val: number) => {
    setPreviewWidth(val);
    try { localStorage.setItem(PREVIEW_WIDTH_KEY, String(val)); } catch {}
  };

  /* ── Load file ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!openFileId) return;
    if (currentFileId.current === openFileId) return;

    // Flush pending save for the previous file — write it back to the workspace it belongs to
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (currentFileId.current && fileStillExists(currentFileId.current)) {
      // In visual mode the source of truth is the div's innerHTML, not React state
      const toSave = (modeRef.current === 'visual' && visualRef.current)
        ? htmlToMarkdown(visualRef.current.innerHTML)
        : content;
      spaceSaveContent(currentFileId.current, toSave, currentFileWsId.current);
    }
    // Отложенная запись уже выполнена (или относилась к другому файлу) — иначе
    // flush при размонтировании положил бы содержимое прошлого файла в новый.
    pendingContent.current = null;

    currentFileId.current = openFileId;
    currentFileWsId.current = wsState.currentId;
    setContent(spaceReadContent(openFileId, wsState.currentId));
    setSaved(true);
    setSlash(null);
    setFileKey((k) => k + 1); // signal visual effect to re-render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFileId, wsState.currentId]);

  /* ── Render visual div (on mode switch OR file change) ────────────── */
  useEffect(() => {
    if (mode === 'visual' && visualRef.current) {
      // content is already the new file's content by the time this effect runs
      const html = parseMarkdown(content);
      visualRef.current.innerHTML = html || '';
      ensureTrailingP(visualRef.current);
    }
  // content excluded intentionally: only reset innerHTML on mode/file change, not on keystrokes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fileKey]);

  /* ── Persist helper ────────────────────────────────────────────────── */
  const persist = useCallback((val: string) => {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingContent.current = val;
    saveTimer.current = setTimeout(() => {
      const id = currentFileId.current;
      // Файл мог быть удалён за время дебаунса — тогда запись создала бы ключ заново.
      if (id && fileStillExists(id)) { spaceSaveContent(id, val, currentFileWsId.current); setSaved(true); }
      pendingContent.current = null;
    }, 600);
  }, [fileStillExists]);

  /* ── Flush on unmount ──────────────────────────────────────────────────
   * Таймер автосейва живёт 600 мс; без досохранения уход со страницы (или
   * размонтирование редактора) просто терял последние правки вместе с таймером. */
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const pending = pendingContent.current;
    const id = currentFileId.current;
    if (pending !== null && id && fileStillExists(id)) {
      spaceSaveContent(id, pending, currentFileWsId.current);
    }
  }, []);

  /* ── Mode switch ───────────────────────────────────────────────────── */
  const switchMode = useCallback((next: Mode) => {
    if (next === mode) return;
    if (next === 'md' && visualRef.current) {
      const md = htmlToMarkdown(visualRef.current.innerHTML);
      setContent(md);
      persist(md);
    }
    setMode(next);
    setSlash(null);
  }, [mode, persist]);

  /* ── Filtered commands ─────────────────────────────────────────────── */
  const q = slash?.query.toLowerCase() ?? '';
  const filteredCmds = slash
    ? CMDS.filter((c) =>
        c.label.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        (c.search ?? '').toLowerCase().includes(q))
    : [];

  const grouped = filteredCmds.reduce<Record<string, Cmd[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c); return acc;
  }, {});

  /* ── Keep the slash menu on-screen when the caret is near a viewport edge ── */
  const slashMenuStyle = (): React.CSSProperties => {
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const style: React.CSSProperties = { left: Math.max(margin, Math.min(slash!.left, vw - 250)) };
    const spaceBelow = vh - slash!.top - margin;
    if (spaceBelow >= 150) {
      style.top = slash!.top;
      style.maxHeight = Math.min(340, spaceBelow);
    } else {
      // Not enough room below the caret — pin the menu to the bottom of the viewport instead.
      style.bottom = margin;
      style.maxHeight = Math.min(340, vh - margin * 2);
    }
    return style;
  };

  /* ── Insert in MD textarea ─────────────────────────────────────────── */
  const insertMdCmd = useCallback((cmd: Cmd) => {
    const ta = taRef.current;
    if (!ta || !slash || slash.mdStart === undefined) return;
    const cursor     = ta.selectionStart;
    const before     = content.slice(0, slash.mdStart);
    const after      = content.slice(cursor);
    const cursorMark = cmd.snippet.indexOf('|');
    const clean      = cmd.snippet.replace('|', '');
    const next       = before + clean + after;
    const nextCursor = cursorMark >= 0 ? slash.mdStart + cursorMark : slash.mdStart + clean.length;
    setContent(next);
    persist(next);
    setSlash(null);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = nextCursor; });
  }, [content, slash, persist]);

  /* ── Insert in visual contentEditable ─────────────────────────────── */
  const insertVisualCmd = useCallback((cmd: Cmd) => {
    if (!slash || !visualRef.current) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const editor = visualRef.current;

    // Walk up from the slash text-node to find the direct child of the editor
    let host: Node | null = slash.node ?? sel.getRangeAt(0).startContainer;
    while (host && host.parentNode !== editor) host = host.parentNode;

    // Is there meaningful text BEFORE the '/' in the same line?
    const textBeforeSlash = (slash.node && slash.nodeOffset !== undefined)
      ? ((slash.node as Text).textContent ?? '').slice(0, slash.nodeOffset).trim()
      : '';

    // Build new DOM nodes from the command's visual markdown
    const tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = parseMarkdown(cmd.visual);
    const newNodes = Array.from(tmpDiv.childNodes) as Node[];

    if (host && host.parentNode === editor) {
      if (textBeforeSlash) {
        // Keep the text that came before '/' inside the existing block,
        // then insert the new blocks right after it
        if (slash.node && slash.nodeOffset !== undefined) {
          (slash.node as Text).textContent =
            (slash.node as Text).textContent!.slice(0, slash.nodeOffset);
        }
        const after = host.nextSibling;
        for (const n of newNodes) editor.insertBefore(n, after);
      } else {
        // The line only had the '/query' — replace the whole block
        for (const n of newNodes) editor.insertBefore(n, host);
        editor.removeChild(host);
      }
    } else {
      for (const n of newNodes) editor.appendChild(n);
    }

    ensureTrailingP(editor);

    // Place cursor at the end of the text inside the first inserted node
    const firstNew = newNodes[0];
    if (firstNew) {
      const r = document.createRange();
      const deepText = (node: Node): Text | null => {
        for (const c of Array.from(node.childNodes)) {
          if (c.nodeType === Node.TEXT_NODE && (c as Text).length > 0) return c as Text;
          const found = deepText(c);
          if (found) return found;
        }
        return null;
      };
      const t = deepText(firstNew);
      if (t) { r.setStart(t, t.length); }
      else    { r.setStartAfter(newNodes[newNodes.length - 1] ?? firstNew); }
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }

    setSlash(null);
    const md = htmlToMarkdown(editor.innerHTML);
    setContent(md);
    persist(md);
  }, [slash, persist]);

  /* ── Unified insert ────────────────────────────────────────────────── */
  const insertCmd = useCallback((cmd: Cmd) => {
    if (mode === 'md') insertMdCmd(cmd);
    else insertVisualCmd(cmd);
  }, [mode, insertMdCmd, insertVisualCmd]);

  /* ── Shared keyboard handler for slash menu ────────────────────────── */
  const slashKeyHandler = (key: string, preventDefault: () => void): boolean => {
    if (!slash || filteredCmds.length === 0) return false;
    if (key === 'ArrowDown') { preventDefault(); setSlashIdx((i) => (i + 1) % filteredCmds.length); return true; }
    if (key === 'ArrowUp')   { preventDefault(); setSlashIdx((i) => (i - 1 + filteredCmds.length) % filteredCmds.length); return true; }
    if (key === 'Enter')     { preventDefault(); insertCmd(filteredCmds[slashIdx]); return true; }
    if (key === 'Escape')    { preventDefault(); setSlash(null); return true; }
    return false;
  };

  /* ── Textarea handlers ─────────────────────────────────────────────── */
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val    = e.target.value;
    const cursor = e.target.selectionStart;
    setContent(val);
    persist(val);

    const before = val.slice(0, cursor);
    const m = before.match(/(^|[\s\n])(\/([^\n/]*))$/);
    if (m) {
      const start  = cursor - m[2].length;
      const coords = taCaretCoords(e.target, start);
      setSlash({ query: m[3], mdStart: start, top: coords.top, left: coords.left });
      setSlashIdx(0);
    } else {
      setSlash(null);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashKeyHandler(e.key, () => e.preventDefault())) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const s  = ta.selectionStart;
      const en = ta.selectionEnd;
      const next = content.slice(0, s) + '  ' + content.slice(en);
      setContent(next);
      persist(next);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      switchMode('visual');
    }
  };

  /* ── Serialize the visual editor back to markdown and persist ──────── */
  const commitVisual = useCallback(() => {
    if (!visualRef.current) return;
    const md = htmlToMarkdown(visualRef.current.innerHTML);
    setContent(md);
    persist(md);
  }, [persist]);

  /**
   * Paste inside a code block as plain text, kept inside the <pre>. Left to the browser, a
   * multi-line paste gets fragmented into sibling <div>s that escape the block — so on the next
   * save the fences are gone and the diagram collapses into ordinary paragraphs. Paste elsewhere
   * keeps its default behavior.
   */
  const handleVisualPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const editor = visualRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    if (!closestTag(sel.getRangeAt(0).startContainer, 'pre', editor)) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    insertTextAtCaret(text);
    commitVisual();
  };

  /* ── Visual (contentEditable) handlers ────────────────────────────── */
  const handleVisualInput = () => {
    if (!visualRef.current) return;
    const md = htmlToMarkdown(visualRef.current.innerHTML);
    setContent(md);
    persist(md);

    // Detect '/' trigger via Selection API
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range     = sel.getRangeAt(0);
    const container = range.startContainer;

    if (container.nodeType !== Node.TEXT_NODE) { setSlash(null); return; }

    const text   = container.textContent ?? '';
    const offset = range.startOffset;
    const before = text.slice(0, offset);
    // Match '/' preceded by line-start or whitespace, followed by optional non-space query
    const m = before.match(/(^|[\s\n])(\/([^\s/\n]*))$/);

    if (m) {
      const slashLocalOffset = offset - m[2].length; // '/' position in text node

      // Get coords via a temporary range at the '/' character
      const slashRange = document.createRange();
      slashRange.setStart(container, slashLocalOffset);
      slashRange.setEnd(container, slashLocalOffset + 1);
      const rect = slashRange.getBoundingClientRect();

      setSlash({
        query: m[3],
        top:   rect.bottom + 6,
        left:  rect.left,
        node:  container,
        nodeOffset: slashLocalOffset,
      });
      setSlashIdx(0);
    } else {
      setSlash(null);
    }
  };

  const handleVisualKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashKeyHandler(e.key, () => e.preventDefault())) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      switchMode('md');
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);

      // Inside a code block: Enter is a literal newline within the <pre>, never a block split.
      if (closestTag(range.startContainer, 'pre', visualRef.current!)) {
        e.preventDefault();
        insertTextAtCaret('\n');
        commitVisual();
        return;
      }

      // Walk up to find if we're inside a heading
      let node: Node | null = range.startContainer;
      while (node && node !== visualRef.current) {
        const tag = (node as Element).tagName?.toLowerCase() ?? '';
        if (/^h[1-6]$/.test(tag)) {
          // Enter inside a heading → create a new paragraph after it, not another heading
          e.preventDefault();
          const heading = node as Element;
          const p = document.createElement('p');
          p.className = 'md-p';
          p.innerHTML = '<br>';
          heading.parentNode!.insertBefore(p, heading.nextSibling);
          const r = document.createRange();
          r.setStart(p, 0); r.collapse(true);
          sel.removeAllRanges(); sel.addRange(r);
          return;
        }
        node = node.parentNode;
      }
    }
  };

  /* ── Close slash menu when cursor leaves '/' context ──────────────── */
  const handleVisualSelect = () => {
    if (!slash) return;
    const sel = window.getSelection();
    if (!sel?.rangeCount) { setSlash(null); return; }
    const range = sel.getRangeAt(0);
    // If cursor moved to a different node, close menu
    if (range.startContainer !== slash.node) { setSlash(null); return; }
    // If cursor is before the '/', close menu
    if (slash.nodeOffset !== undefined && range.startOffset < slash.nodeOffset) setSlash(null);
  };

  /* ── Empty state ───────────────────────────────────────────────────── */
  if (!openNode) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-icon">◆</div>
        <div className="editor-empty-text">Выбери файл или создай новый</div>
      </div>
    );
  }

  return (
    <div className="editor-wrap">

      {/* Toolbar */}
      <div className="editor-toolbar">
        <span className="editor-filename">{openNode.name}</span>
        <div className="editor-toolbar-right">
          {!saved && <span className="editor-saving">сохранение...</span>}
          {mode === 'visual' && (
            <div className="editor-width-control" title="Ширина текста">
              <input
                type="range"
                min={40}
                max={100}
                step={5}
                value={previewWidth}
                onChange={(e) => handlePreviewWidthChange(Number(e.target.value))}
              />
              <span className="editor-width-value">{previewWidth}%</span>
            </div>
          )}
          <div className="editor-mode-toggle">
            <button
              className={`editor-mode-btn${mode === 'md' ? ' active' : ''}`}
              onClick={() => switchMode('md')}
              title="Markdown редактор (Ctrl+P)"
            >
              MD
            </button>
            <button
              className={`editor-mode-btn${mode === 'visual' ? ' active' : ''}`}
              onClick={() => switchMode('visual')}
              title="Визуальный редактор (Ctrl+P)"
            >
              Просмотр
            </button>
          </div>
        </div>
      </div>

      {/* MD textarea */}
      {mode === 'md' && (
        <textarea
          ref={taRef}
          className="editor-textarea"
          value={content}
          onChange={handleTextareaInput}
          onKeyDown={handleTextareaKeyDown}
          placeholder={'# Заголовок\n\nНачни писать... или введи / для вставки блока'}
          spellCheck={false}
        />
      )}

      {/* Visual / WYSIWYG */}
      {mode === 'visual' && (
        <div className="editor-visual-scroll">
          <div
            ref={visualRef}
            className="editor-preview editor-visual"
            style={{ '--preview-width': `${previewWidth}%` } as React.CSSProperties}
            contentEditable
            suppressContentEditableWarning
            onInput={handleVisualInput}
            onKeyDown={handleVisualKeyDown}
            onPaste={handleVisualPaste}
            onSelect={handleVisualSelect}
            data-placeholder="Начни вводить... или введи / для вставки блока"
          />
        </div>
      )}

      {/* Slash command menu */}
      {slash && filteredCmds.length > 0 && (
        <div className="slash-menu" style={slashMenuStyle()}>
          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group} className="slash-group">
              <div className="slash-group-label">{group}</div>
              {cmds.map((cmd) => {
                const idx = filteredCmds.indexOf(cmd);
                return (
                  <div
                    key={cmd.id}
                    className={`slash-item${idx === slashIdx ? ' active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); insertCmd(cmd); }}
                    onMouseEnter={() => setSlashIdx(idx)}
                  >
                    <span className="slash-icon">
                      {cmd.svgIcon
                        ? <Icon name={cmd.svgIcon} size={15} style={cmd.id === 'detail' ? { transform: 'rotate(-90deg)' } : undefined} />
                        : cmd.icon}
                    </span>
                    <span className="slash-label">{cmd.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

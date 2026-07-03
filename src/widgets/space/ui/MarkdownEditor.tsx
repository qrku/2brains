'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSpaceStore, spaceReadContent, spaceSaveContent } from '@/app/providers/SpaceStoreProvider';
import { parseMarkdown } from '@/shared/lib/markdown';
import { htmlToMarkdown } from '@/shared/lib/htmlToMarkdown';

/* ─── Slash commands ──────────────────────────────────────────────────────── */
interface Cmd {
  id: string;
  icon: string;
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
  { id: 'ul',     icon: '•',  group: 'Списки',    label: 'Маркированный', snippet: '- |',                                                          visual: '- Элемент'                                                        },
  { id: 'ol',     icon: '1.', group: 'Списки',    label: 'Нумерованный',  snippet: '1. |',                                                         visual: '1. Элемент'                                                       },
  { id: 'todo',   icon: '☐',  group: 'Списки',    label: 'Задача',        snippet: '- [ ] |',                                                      visual: '- [ ] Задача'                                                     },
  { id: 'quote',  icon: '❝',  group: 'Блоки',     label: 'Цитата',        snippet: '> |',                                                          visual: '> Цитата'                                                         },
  { id: 'code',   icon: '<>', group: 'Блоки',     label: 'Блок кода',     snippet: '```\n|\n```',                                                  visual: '```\nКод\n```'                                                    },
  { id: 'detail', icon: '▸',  group: 'Блоки',     label: 'Детали / Спойлер', snippet: '<details>\n<summary>|</summary>\n\n\n</details>',          visual: '<details>\n<summary>Заголовок</summary>\n\nСодержание\n\n</details>', search: 'details detail spoiler спойлер' },
  { id: 'hr',     icon: '—',  group: 'Блоки',     label: 'Разделитель',   snippet: '\n---\n|',                                                     visual: '---'                                                              },
  { id: 'table',  icon: '⊞',  group: 'Блоки',     label: 'Таблица',       snippet: '| Кол 1 | Кол 2 |\n|---|---|\n| | |',                         visual: '| Кол 1 | Кол 2 |\n|---|---|\n| Ячейка | Ячейка |'             },
  { id: 'bold',   icon: 'B',  group: 'Формат',    label: 'Жирный',        snippet: '**|**',                                                        visual: '**жирный**'                                                       },
  { id: 'italic', icon: 'I',  group: 'Формат',    label: 'Курсив',        snippet: '*|*',                                                          visual: '*курсив*'                                                         },
  { id: 'strike', icon: 'S',  group: 'Формат',    label: 'Зачёркнутый',  snippet: '~~|~~',                                                        visual: '~~зачёркнутый~~'                                                  },
  { id: 'icode',  icon: '`',  group: 'Формат',    label: 'Код в строке',  snippet: '`|`',                                                          visual: '`код`'                                                            },
  { id: 'mark',   icon: '=',  group: 'Формат',    label: 'Выделение',     snippet: '==|==',                                                        visual: '==выделение=='                                                    },
];

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

  const [mode,     setMode]     = useState<Mode>('md');
  const [content,  setContent]  = useState('');
  const [saved,    setSaved]    = useState(true);
  const [slash,    setSlash]    = useState<SlashState | null>(null);
  const [slashIdx, setSlashIdx] = useState(0);

  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFileId = useRef<string | null>(null);
  const taRef         = useRef<HTMLTextAreaElement>(null);
  const visualRef     = useRef<HTMLDivElement>(null);
  // Always-current ref so file-load effect can read mode without stale closure
  const modeRef       = useRef<Mode>('md');
  useEffect(() => { modeRef.current = mode; });

  // Increments every time a different file is opened — used to trigger visual refresh
  const [fileKey, setFileKey] = useState(0);

  const openNode = openFileId ? nodes.find((n) => n.id === openFileId) : null;

  /* ── Load file ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!openFileId) return;
    if (currentFileId.current === openFileId) return;

    // Flush pending save for the previous file
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (currentFileId.current) {
      // In visual mode the source of truth is the div's innerHTML, not React state
      const toSave = (modeRef.current === 'visual' && visualRef.current)
        ? htmlToMarkdown(visualRef.current.innerHTML)
        : content;
      spaceSaveContent(currentFileId.current, toSave);
    }

    currentFileId.current = openFileId;
    setContent(spaceReadContent(openFileId));
    setSaved(true);
    setSlash(null);
    setFileKey((k) => k + 1); // signal visual effect to re-render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFileId]);

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
    saveTimer.current = setTimeout(() => {
      if (currentFileId.current) { spaceSaveContent(currentFileId.current, val); setSaved(true); }
    }, 600);
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
        <div
          ref={visualRef}
          className="editor-preview editor-visual"
          contentEditable
          suppressContentEditableWarning
          onInput={handleVisualInput}
          onKeyDown={handleVisualKeyDown}
          onSelect={handleVisualSelect}
          data-placeholder="Начни вводить... или введи / для вставки блока"
        />
      )}

      {/* Slash command menu */}
      {slash && filteredCmds.length > 0 && (
        <div className="slash-menu" style={{ top: slash.top, left: slash.left }}>
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
                    <span className="slash-icon">{cmd.icon}</span>
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

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSpaceStore } from '@/entities/space';
import { useWorkspaceStore } from '@/entities/workspace';
import { parseMarkdown } from '@/shared/lib/markdown';
import { htmlToMarkdown } from '@/shared/lib/htmlToMarkdown';
import {
  closestTag,
  insertTextAtCaret,
  ensureTrailingP,
  trailingEmptyP,
  topBlock,
  caretToBlockStart,
  closestInlineFormat,
  dropEmptyFormatting,
  normalizeBlocks,
  activateCheckboxes,
  ZWSP,
} from '../model/contentEditableUtils';
import { taCaretCoords } from '../model/taCaretCoords';
import { usePreviewWidth } from '../model/usePreviewWidth';
import { useSlashMenu } from '../model/useSlashMenu';
import { useFileContent } from '../model/useFileContent';
import type { Cmd } from '../model/slash/types';
import Slash from './Slash';

/* ─── Types ────────────────────────────────────────────────────────────────── */
type Mode = 'md' | 'visual';

/* ─── Component ────────────────────────────────────────────────────────────── */
export function MarkdownEditor() {
  const { state } = useSpaceStore();
  const { openFileId, nodes } = state;
  const { state: wsState } = useWorkspaceStore();

  const [mode, setMode] = useState<Mode>('visual');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);

  const openNode = openFileId ? nodes.find((n) => n.id === openFileId) : null;

  const { previewWidth, handlePreviewWidthChange } = usePreviewWidth();
  const { slash, setSlash, slashIdx, setSlashIdx, menuRef, slashKeyHandler } = useSlashMenu();
  const { content, setContent, saved, persist, fileKey } = useFileContent({
    openFileId,
    workspaceId: wsState.currentId,
    nodes,
    mode,
    visualRef,
    onFileSwitch: () => setSlash(null),
  });

  /* ── Render visual div (on mode switch OR file change) ────────────── */
  useEffect(() => {
    if (mode === 'visual' && visualRef.current) {
      // content is already the new file's content by the time this effect runs
      const html = parseMarkdown(content);
      visualRef.current.innerHTML = html || '';
      activateCheckboxes(visualRef.current);
      ensureTrailingP(visualRef.current);
    }
    // content excluded intentionally: only reset innerHTML on mode/file change, not on keystrokes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fileKey]);

  /* ── Mode switch ───────────────────────────────────────────────────── */
  const switchMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      if (next === 'md' && visualRef.current) {
        const md = htmlToMarkdown(visualRef.current.innerHTML);
        setContent(md);
        persist(md);
      }
      setMode(next);
      setSlash(null);
    },
    [mode, persist, setContent, setSlash],
  );

  /* ── Insert in MD textarea ─────────────────────────────────────────── */
  const insertMdCmd = useCallback(
    (cmd: Cmd) => {
      const ta = taRef.current;
      if (!ta || !slash || slash.mdStart === undefined) return;
      const cursor = ta.selectionStart;
      const before = content.slice(0, slash.mdStart);
      const after = content.slice(cursor);
      const cursorMark = cmd.snippet.indexOf('|');
      const clean = cmd.snippet.replace('|', '');
      const next = before + clean + after;
      const nextCursor =
        cursorMark >= 0 ? slash.mdStart + cursorMark : slash.mdStart + clean.length;
      setContent(next);
      persist(next);
      setSlash(null);
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = nextCursor;
      });
    },
    [content, slash, persist, setContent, setSlash],
  );

  /* ── Insert in visual contentEditable ─────────────────────────────── */
  const insertVisualCmd = useCallback(
    (cmd: Cmd) => {
      if (!slash || !visualRef.current) return;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;

      const editor = visualRef.current;

      // Walk up from the slash text-node to find the direct child of the editor
      let host: Node | null = slash.node ?? sel.getRangeAt(0).startContainer;
      while (host && host.parentNode !== editor) host = host.parentNode;

      // Is there meaningful text BEFORE the '/' in the same line?
      const textBeforeSlash =
        slash.node && slash.nodeOffset !== undefined
          ? ((slash.node as Text).textContent ?? '').slice(0, slash.nodeOffset).trim()
          : '';

      // Build new DOM nodes from the command's visual markdown
      const tmpDiv = document.createElement('div');
      tmpDiv.innerHTML = parseMarkdown(cmd.visual);
      activateCheckboxes(tmpDiv);
      const newNodes = Array.from(tmpDiv.childNodes) as Node[];

      if (host && host.parentNode === editor) {
        if (textBeforeSlash) {
          // Keep the text that came before '/' inside the existing block,
          // then insert the new blocks right after it
          if (slash.node && slash.nodeOffset !== undefined) {
            (slash.node as Text).textContent = (slash.node as Text).textContent!.slice(
              0,
              slash.nodeOffset,
            );
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

      // Select the placeholder text of the first inserted node, so the next keystroke
      // replaces it. Раньше каретка вставала после плейсхолдера — «выделение» приходилось
      // стирать вручную, а набранный текст прилипал к нему.
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
        if (t) {
          r.setStart(t, 0);
          r.setEnd(t, t.length);
        } else {
          r.setStartAfter(newNodes[newNodes.length - 1] ?? firstNew);
          r.collapse(true);
        }
        sel.removeAllRanges();
        sel.addRange(r);
      }

      setSlash(null);
      const md = htmlToMarkdown(editor.innerHTML);
      setContent(md);
      persist(md);
    },
    [slash, persist, setContent, setSlash],
  );

  /* ── Unified insert ────────────────────────────────────────────────── */
  const insertCmd = useCallback(
    (cmd: Cmd) => {
      if (mode === 'md') insertMdCmd(cmd);
      else insertVisualCmd(cmd);
    },
    [mode, insertMdCmd, insertVisualCmd],
  );

  /* ── Textarea handlers ─────────────────────────────────────────────── */
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    setContent(val);
    persist(val);

    const before = val.slice(0, cursor);
    const m = before.match(/(^|[\s\n])(\/([^\n/]*))$/);
    if (m) {
      const start = cursor - m[2].length;
      const coords = taCaretCoords(e.target, start);
      setSlash({ query: m[3], mdStart: start, top: coords.top, left: coords.left });
      setSlashIdx(0);
    } else {
      setSlash(null);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashKeyHandler(e.key, () => e.preventDefault(), insertCmd)) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const s = ta.selectionStart;
      const en = ta.selectionEnd;
      const next = content.slice(0, s) + '  ' + content.slice(en);
      setContent(next);
      persist(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = s + 2;
      });
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
  }, [persist, setContent]);

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
    const range = sel.getRangeAt(0);
    const container = range.startContainer;

    if (container.nodeType !== Node.TEXT_NODE) {
      setSlash(null);
      return;
    }

    const text = container.textContent ?? '';
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
        top: rect.bottom + 6,
        left: rect.left,
        node: container,
        nodeOffset: slashLocalOffset,
      });
      setSlashIdx(0);
    } else {
      setSlash(null);
    }
  };

  const handleVisualKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashKeyHandler(e.key, () => e.preventDefault(), insertCmd)) return;

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
          r.setStart(p, 0);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          return;
        }
        node = node.parentNode;
      }

      // Enter внутри <mark> и подобных: браузер копирует обёртку в новый блок, и всё
      // набранное там остаётся выделенным. Разрываем абзац сами и сразу — отложенная
      // чистка не годится, набор текста успевает начаться раньше неё.
      const editor = visualRef.current;
      const fmt = editor && closestInlineFormat(range.startContainer, editor);
      const block = editor && topBlock(range.startContainer, editor);
      if (editor && fmt && block?.tagName === 'P') {
        e.preventDefault();
        // Всё, что правее каретки, переезжает в новый абзац вместе со своим
        // форматированием; пустые огрызки обёрток отбрасываем с обеих сторон.
        const tail = document.createRange();
        tail.setStart(range.startContainer, range.startOffset);
        tail.setEnd(block, block.childNodes.length);
        const next = document.createElement('p');
        next.className = 'md-p';
        next.appendChild(tail.extractContents());
        dropEmptyFormatting(next);
        dropEmptyFormatting(block);
        if (!next.firstChild) next.appendChild(document.createElement('br'));
        if (!block.firstChild) block.appendChild(document.createElement('br'));
        block.parentNode!.insertBefore(next, block.nextSibling);
        caretToBlockStart(next);
        commitVisual();
        return;
      }

      // Остальные блоки (списки, цитаты) делит браузер — за ним подчищаем пустые
      // обёртки форматирования следующим кадром.
      requestAnimationFrame(() => {
        if (!editor) return;
        normalizeBlocks(editor);
        if (dropEmptyFormatting(editor)) commitVisual();
      });
      return;
    }

    // Выход из инлайнового форматирования вправо: каретка на границе <mark> и так
    // остаётся внутри него, поэтому уводим её наружу через zero-width space.
    if (e.key === 'ArrowRight' && !e.shiftKey && !e.metaKey && !e.altKey) {
      const editor = visualRef.current;
      const sel = window.getSelection();
      if (!editor || !sel?.rangeCount || !sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const fmt = closestInlineFormat(range.startContainer, editor);
      if (!fmt) return;
      // Каретка ровно в конце содержимого обёртки?
      const atEnd = document.createRange();
      atEnd.selectNodeContents(fmt);
      atEnd.setStart(range.startContainer, range.startOffset);
      if (atEnd.toString() !== '') return;

      e.preventDefault();
      let after = fmt.nextSibling as Text | null;
      if (!after || after.nodeType !== Node.TEXT_NODE) {
        after = document.createTextNode(ZWSP);
        fmt.parentNode!.insertBefore(after, fmt.nextSibling);
      } else if (!after.data.startsWith(ZWSP)) {
        after.insertData(0, ZWSP);
      }
      const r = document.createRange();
      r.setStart(after, 1);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      return;
    }

    // Стрелка вниз из последнего блока: если браузеру некуда вести каретку
    // (конец таблицы, кода, цитаты), выводим её в следующий блок или создаём
    // новый абзац в конце документа.
    if (e.key === 'ArrowDown' && !e.shiftKey && !e.metaKey && !e.altKey) {
      const sel = window.getSelection();
      if (!sel?.rangeCount || !sel.isCollapsed) return;
      const { startContainer, startOffset } = sel.getRangeAt(0);
      requestAnimationFrame(() => {
        const editor = visualRef.current;
        const now = window.getSelection();
        if (!editor || !now?.rangeCount) return;
        const r = now.getRangeAt(0);
        // Каретка сдвинулась — браузер справился сам.
        if (r.startContainer !== startContainer || r.startOffset !== startOffset) return;
        if (!editor.contains(r.startContainer)) return;

        const host = topBlock(r.startContainer, editor);
        if (!host) return;
        // Разделитель каретку не принимает — перешагиваем через него.
        let next = host.nextElementSibling as HTMLElement | null;
        while (next && next.tagName === 'HR') next = next.nextElementSibling as HTMLElement | null;
        caretToBlockStart(next ?? trailingEmptyP(editor));
      });
      return;
    }
  };

  /* ── Task checkboxes ───────────────────────────────────────────────────────
   * innerHTML сериализует атрибут, а не свойство, поэтому переключаем оба.
   * preventDefault здесь звать нельзя: отменённая активация чекбокса откатывает
   * `checked` обратно уже после обработчика — галочка не появлялась. */
  const handleVisualClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains('md-checkbox')) return;
    const checked = !target.hasAttribute('checked');
    target.checked = checked;
    if (checked) target.setAttribute('checked', '');
    else target.removeAttribute('checked');
    commitVisual();
  };

  /* ── Close slash menu when cursor leaves '/' context ────────────────── */
  const handleVisualSelect = () => {
    if (!slash) return;
    const sel = window.getSelection();
    if (!sel?.rangeCount) {
      setSlash(null);
      return;
    }
    const range = sel.getRangeAt(0);
    // If cursor moved to a different node, close menu
    if (range.startContainer !== slash.node) {
      setSlash(null);
      return;
    }
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
            onClick={handleVisualClick}
            data-placeholder="Начни вводить... или введи / для вставки блока"
          />
        </div>
      )}

      <Slash
        slash={slash}
        activeIndex={slashIdx}
        onHover={setSlashIdx}
        onSelect={insertCmd}
        menuRef={menuRef}
      />
    </div>
  );
}

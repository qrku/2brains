'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useSpaceStore } from '@/entities/space';

export interface SpaceFile {
  id: string;
  name: string;
}

/** How a reference to a Space file is stored inside a node's plain-text body. */
export const spaceRefNotation = (f: SpaceFile) => `[[space:${f.id}|${f.name}]]`;

/**
 * Where to hang the menu, in viewport coords.
 *
 * A collapsed caret in an *empty* contentEditable has no layout box — getBoundingClientRect()
 * returns an all-zero rect, which would pin the menu to the top-left of the page. Fall back to
 * the editor's own box in that case, so a "/" in a fresh block still opens under the block.
 */
function caretAnchor(range: Range, editor: HTMLElement | null): { x: number; y: number } {
  const r = range.getBoundingClientRect();
  if (r.width || r.height) return { x: r.left, y: r.bottom };

  const box = editor?.getBoundingClientRect();
  return box ? { x: box.left, y: box.bottom } : { x: 0, y: 0 };
}

export interface SlashMenu {
  open: boolean;
  x: number;
  y: number;
  query: string;
  activeIndex: number;
  files: SpaceFile[];
  insert: (f: SpaceFile) => void;
  close: () => void;
  /** Returns true when the key belonged to the menu and the editor should ignore it. */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

/**
 * The "/" file picker inside a node's editor. Typing is captured by the menu rather than
 * inserted into the node, so the query never pollutes the node's text if the menu is dismissed.
 */
/**
 * `enabled` is false for plain text nodes: those are prose, and "/" there is just a slash.
 * Only box nodes take file references.
 */
export function useSlashMenu(
  editorRef: RefObject<HTMLDivElement | null>,
  onTextInput: (text: string) => void,
  enabled: boolean,
): SlashMenu {
  const { state: spaceState } = useSpaceStore();
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const savedRange = useRef<Range | null>(null);

  const allFiles = useMemo(
    () => spaceState.nodes.filter((n) => n.type === 'file').map(({ id, name }) => ({ id, name })),
    [spaceState.nodes],
  );

  const files = useMemo(
    () => allFiles.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [allFiles, query],
  );

  useEffect(() => {
    if (!enabled) {
      setAnchor(null);
      setQuery('');
    }
  }, [enabled]);

  const close = useCallback(() => {
    setAnchor(null);
    setQuery('');
    editorRef.current?.focus();
  }, [editorRef]);

  const insert = useCallback(
    (f: SpaceFile) => {
      const el = editorRef.current;
      if (!el) return;

      el.focus();
      // The caret was lost when the menu took focus — put it back where "/" was typed.
      const sel = window.getSelection();
      if (savedRange.current && sel) {
        sel.removeAllRanges();
        sel.addRange(savedRange.current);
      }
      // execCommand is deprecated but is the only insertion that keeps the editor's native undo stack.
      document.execCommand('insertText', false, spaceRefNotation(f));
      onTextInput(el.textContent ?? '');

      setAnchor(null);
      setQuery('');
      savedRange.current = null;
    },
    [editorRef, onTextInput],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!enabled) return false;

      if (e.key === '/') {
        const sel = window.getSelection();
        if (!sel?.rangeCount) return false;
        e.preventDefault();

        const range = sel.getRangeAt(0);
        savedRange.current = range.cloneRange();
        setAnchor(caretAnchor(range, editorRef.current));
        setQuery('');
        setActiveIndex(0);
        return true;
      }

      if (!anchor) return false;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          close();
          return true;

        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, Math.max(0, files.length - 1)));
          return true;

        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => Math.max(0, i - 1));
          return true;

        case 'Enter':
          e.preventDefault();
          if (files[activeIndex]) insert(files[activeIndex]);
          return true;

        case 'Backspace':
          e.preventDefault();
          if (query) {
            setQuery((q) => q.slice(0, -1));
            setActiveIndex(0);
          } else close();
          return true;

        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            setQuery((q) => q + e.key);
            setActiveIndex(0);
            return true;
          }
          return false;
      }
    },
    [enabled, editorRef, anchor, files, activeIndex, query, insert, close],
  );

  return {
    open: !!anchor,
    x: anchor?.x ?? 0,
    y: anchor?.y ?? 0,
    query,
    activeIndex: Math.min(activeIndex, Math.max(0, files.length - 1)),
    files,
    insert,
    close,
    handleKeyDown,
  };
}

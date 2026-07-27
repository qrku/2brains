import { renderHook, act } from '@testing-library/react';
import type { RefObject } from 'react';
import { useSlashMenu } from './useSlashMenu';

// The hook reaches into the SpaceStore for the list of files it can reference.
// Feed it a fixed set: two files and one folder (the folder must be filtered out).
jest.mock('@/app/providers/SpaceStoreProvider', () => ({
  useSpaceStore: () => ({
    state: {
      nodes: [
        { id: 'f1', name: 'Arrays', type: 'file' },
        { id: 'f2', name: 'Graphs', type: 'file' },
        { id: 'd1', name: 'Folder', type: 'folder' },
      ],
    },
  }),
}));

/** A live contentEditable + a hook instance pointing at it. */
function setup(opts: { enabled?: boolean; text?: string } = {}) {
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.textContent = opts.text ?? '';
  document.body.appendChild(editor);

  const editorRef = { current: editor } as RefObject<HTMLDivElement | null>;
  const onTextInput = jest.fn();

  const view = renderHook(
    ({ enabled }) => useSlashMenu(editorRef, onTextInput, enabled),
    { initialProps: { enabled: opts.enabled ?? true } },
  );

  return { editor, editorRef, onTextInput, ...view };
}

/** Put a real (collapsed) selection inside the editor — the "/" branch reads it. */
function placeCaret(editor: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Drive one keydown through the hook and return whether it was consumed. */
function press(result: { current: ReturnType<typeof useSlashMenu> }, key: string) {
  const e = {
    key,
    preventDefault: jest.fn(),
    ctrlKey: false, metaKey: false, altKey: false,
  } as unknown as React.KeyboardEvent;

  let handled = false;
  act(() => { handled = result.current.handleKeyDown(e); });
  return { handled, preventDefault: e.preventDefault as jest.Mock };
}

// jsdom doesn't implement Range.getBoundingClientRect. A collapsed caret has no box
// anyway, so return an all-zero rect — the hook then falls back to the editor's box.
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0,
    toJSON: () => ({}),
  }) as DOMRect;
});

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

describe('useSlashMenu', () => {
  it('starts closed and lists only file nodes', () => {
    const { result } = setup();
    expect(result.current.open).toBe(false);
    expect(result.current.files.map((f) => f.name)).toEqual(['Arrays', 'Graphs']);
  });

  it('does nothing while disabled', () => {
    const { result, editor } = setup({ enabled: false });
    placeCaret(editor);
    const { handled } = press(result, '/');
    expect(handled).toBe(false);
    expect(result.current.open).toBe(false);
  });

  describe('opening on "/"', () => {
    it('opens when there is a caret in the editor', () => {
      const { result, editor } = setup();
      placeCaret(editor);
      const { handled, preventDefault } = press(result, '/');
      expect(handled).toBe(true);
      expect(preventDefault).toHaveBeenCalled();
      expect(result.current.open).toBe(true);
    });

    it('stays closed when there is no selection', () => {
      const { result } = setup();
      window.getSelection()?.removeAllRanges();
      const { handled } = press(result, '/');
      expect(handled).toBe(false);
      expect(result.current.open).toBe(false);
    });
  });

  describe('once open', () => {
    function open() {
      const s = setup();
      placeCaret(s.editor);
      press(s.result, '/');
      return s;
    }

    it('narrows the file list as the query is typed and resets the active index', () => {
      const { result } = open();
      press(result, 'g');
      expect(result.current.query).toBe('g');
      expect(result.current.files.map((f) => f.name)).toEqual(['Graphs']);
      expect(result.current.activeIndex).toBe(0);
    });

    it('moves the active index with arrows and clamps at the ends', () => {
      const { result } = open();
      expect(result.current.activeIndex).toBe(0);

      press(result, 'ArrowDown');
      expect(result.current.activeIndex).toBe(1);
      press(result, 'ArrowDown'); // already at last file — clamp
      expect(result.current.activeIndex).toBe(1);

      press(result, 'ArrowUp');
      press(result, 'ArrowUp'); // already at first — clamp
      expect(result.current.activeIndex).toBe(0);
    });

    it('Backspace trims the query, then closes on an empty query', () => {
      const { result } = open();
      press(result, 'g');
      expect(result.current.query).toBe('g');

      press(result, 'Backspace');
      expect(result.current.query).toBe('');
      expect(result.current.open).toBe(true);

      press(result, 'Backspace');
      expect(result.current.open).toBe(false);
    });

    it('Escape closes the menu', () => {
      const { result } = open();
      press(result, 'Escape');
      expect(result.current.open).toBe(false);
    });

    it('Enter inserts the active file, notifies text change, and closes', () => {
      // execCommand is a jsdom no-op; stub it so the insert path stays quiet and observable.
      document.execCommand = jest.fn();
      const { result, onTextInput } = open();

      press(result, 'Enter'); // active file is "Arrays"
      expect(document.execCommand).toHaveBeenCalledWith(
        'insertText', false, '[[space:f1|Arrays]]',
      );
      expect(onTextInput).toHaveBeenCalled();
      expect(result.current.open).toBe(false);
    });
  });
});

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { keymap, placeholder, EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { safeUrl } from '@/shared/lib/safeUrl';
import { Highlight } from './highlightSyntax';
import { livePreview } from './livePreview';
import { slashMenu } from './slash';
import { editorHighlight, editorTheme } from './theme';
import { enterBlock, toggleTask } from './widgets';

/** Ссылка под курсором мыши — вместе с адресом, уже пропущенным через `safeUrl`. */
function linkAt(view: EditorView, event: MouseEvent): string | null {
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos === null) return null;
  for (let node = syntaxTree(view.state).resolveInner(pos, 1); node; node = node.parent!) {
    if (node.name === 'Autolink') {
      return safeUrl(view.state.doc.sliceString(node.from, node.to).replace(/^<|>$/g, ''));
    }
    if (node.name === 'Link') {
      const url = node.getChild('URL');
      return url ? safeUrl(view.state.doc.sliceString(url.from, url.to)) : null;
    }
    if (!node.parent) break;
  }
  return null;
}

const interactions = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (toggleTask(view, event.target)) return true;
    // Ctrl/Cmd+клик открывает ссылку; обычный — ставит каретку и показывает
    // исходную разметку, иначе адрес было бы не отредактировать.
    if (event.metaKey || event.ctrlKey) {
      const href = linkAt(view, event);
      if (href) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return true;
      }
    }
    return false;
  },
  click(event, view) {
    return enterBlock(view, event.target);
  },
});

/**
 * Расширения редактора Пространства.
 *
 * Порядок важен: `markdown()` ставит свой keymap (Enter продолжает список,
 * Backspace снимает разметку) и должен опережать базовый — при равном
 * приоритете CodeMirror пробует привязки в порядке добавления.
 */
export function spaceEditorExtensions(placeholderText: string): Extension[] {
  return [
    history(),
    markdown({ base: markdownLanguage, extensions: [Highlight] }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    livePreview,
    slashMenu,
    interactions,
    placeholder(placeholderText),
    editorTheme,
    editorHighlight,
  ];
}

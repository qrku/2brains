import {
  autocompletion,
  snippet,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import { ICONS } from '@/shared/ui/Icon';
import { CMDS, filterCmds } from '../slash/consts';
import type { Cmd } from '../slash/types';

/**
 * Меню «/» — для тех, кто не помнит синтаксис markdown.
 *
 * Построено на автодополнении CodeMirror, а не на своём попапе: навигация
 * стрелками, автоскролл, удержание в границах экрана и закрытие при уходе
 * каретки уже реализованы там. Вставка идёт через `snippet()` — он же даёт
 * позиции заполнителей по Tab.
 */

/** Обратная связь «пункт меню → команда»: `Completion` не носит своих полей. */
const BY_LABEL = new Map<string, Cmd>(CMDS.map((cmd) => [cmd.label, cmd]));

/** Узлы, внутри которых «/» — обычный символ, а не команда. */
const LITERAL_NODES = /^(FencedCode|CodeBlock|InlineCode|CodeText|URL|HTMLBlock|HTMLTag)$/;

export function slashSource(context: CompletionContext): CompletionResult | null {
  const match = context.matchBefore(/\/[^\s/]*/);
  if (!match) return null;

  // «/» считается командой только в начале строки или после пробела — иначе
  // любой путь вроде `src/app` открывал бы меню.
  const prev = context.state.doc.sliceString(match.from - 1, match.from);
  if (match.from > 0 && prev !== '' && !/\s/.test(prev)) return null;

  const node = syntaxTree(context.state).resolveInner(match.from, 1);
  for (let n: typeof node | null = node; n; n = n.parent) {
    if (LITERAL_NODES.test(n.name)) return null;
  }

  const query = match.text.slice(1);
  const cmds = filterCmds(query);
  if (cmds.length === 0) return null;

  return {
    from: match.from,
    // Фильтруем сами: `filterCmds` умеет искать по группе и англоязычным
    // синонимам, чего встроенное сопоставление по label не даст.
    filter: false,
    options: cmds.map((cmd): Completion => ({
      label: cmd.label,
      section: cmd.group,
      apply: snippet(cmd.snippet),
    })),
  };
}

/** Иконка пункта: SVG из общего реестра, иначе текстовый глиф. */
function renderIcon(completion: Completion): Node | null {
  const cmd = BY_LABEL.get(completion.label);
  if (!cmd) return null;

  const host = document.createElement('span');
  host.className = 'cm-slash-icon';

  if (cmd.svgIcon && ICONS[cmd.svgIcon]) {
    const { viewBox, html } = ICONS[cmd.svgIcon];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('fill', 'none');
    if (cmd.id === 'detail') svg.setAttribute('transform', 'rotate(-90)');
    svg.innerHTML = html;
    host.appendChild(svg);
  } else {
    host.textContent = cmd.icon;
  }
  return host;
}

export const slashMenu = autocompletion({
  override: [slashSource],
  icons: false,
  activateOnTyping: true,
  // Позиция 10 ставит иконку перед подписью (сама подпись идёт на 50).
  addToOptions: [{ render: renderIcon, position: 10 }],
});

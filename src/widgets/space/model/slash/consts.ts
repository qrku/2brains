import type { Cmd } from './types';

const CMDS: Cmd[] = [
  {
    id: 'h1',
    icon: 'H1',
    group: 'Заголовки',
    label: 'Заголовок 1',
    snippet: '# |',
    visual: '# Заголовок',
  },
  {
    id: 'h2',
    icon: 'H2',
    group: 'Заголовки',
    label: 'Заголовок 2',
    snippet: '## |',
    visual: '## Заголовок',
  },
  {
    id: 'h3',
    icon: 'H3',
    group: 'Заголовки',
    label: 'Заголовок 3',
    snippet: '### |',
    visual: '### Заголовок',
  },
  {
    id: 'h4',
    icon: 'H4',
    group: 'Заголовки',
    label: 'Заголовок 4',
    snippet: '#### |',
    visual: '#### Заголовок',
  },
  {
    id: 'ul',
    icon: '•',
    svgIcon: 'list',
    group: 'Списки',
    label: 'Маркированный',
    snippet: '- |',
    visual: '- Элемент',
  },
  {
    id: 'ol',
    icon: '1.',
    group: 'Списки',
    label: 'Нумерованный',
    snippet: '1. |',
    visual: '1. Элемент',
  },
  {
    id: 'todo',
    icon: '☐',
    svgIcon: 'list-check',
    group: 'Списки',
    label: 'Задача',
    snippet: '- [ ] |',
    visual: '- [ ] Задача',
  },
  { id: 'quote', icon: '❝', group: 'Блоки', label: 'Цитата', snippet: '> |', visual: '> Цитата' },
  {
    id: 'code',
    icon: '<>',
    group: 'Блоки',
    label: 'Блок кода',
    snippet: '```\n|\n```',
    visual: '```\nКод\n```',
  },
  {
    id: 'detail',
    icon: '▸',
    svgIcon: 'chevron-down',
    group: 'Блоки',
    label: 'Детали / Спойлер',
    snippet: '<details>\n<summary>|</summary>\n\n\n</details>',
    visual: '<details>\n<summary>Заголовок</summary>\n\nСодержание\n\n</details>',
    search: 'details detail spoiler спойлер',
  },
  { id: 'hr', icon: '—', group: 'Блоки', label: 'Разделитель', snippet: '\n---\n|', visual: '---' },
  {
    id: 'table',
    icon: '⊞',
    svgIcon: 'grid',
    group: 'Блоки',
    label: 'Таблица',
    snippet: '| Кол 1 | Кол 2 |\n|---|---|\n| | |',
    visual: '| Кол 1 | Кол 2 |\n|---|---|\n| Ячейка | Ячейка |',
  },
  {
    id: 'bold',
    icon: 'B',
    svgIcon: 'format-bold',
    group: 'Формат',
    label: 'Жирный',
    snippet: '**|**',
    visual: '**жирный**',
  },
  { id: 'italic', icon: 'I', group: 'Формат', label: 'Курсив', snippet: '*|*', visual: '*курсив*' },
  {
    id: 'strike',
    icon: 'S',
    group: 'Формат',
    label: 'Зачёркнутый',
    snippet: '~~|~~',
    visual: '~~зачёркнутый~~',
  },
  {
    id: 'icode',
    icon: '`',
    group: 'Формат',
    label: 'Код в строке',
    snippet: '`|`',
    visual: '`код`',
  },
  {
    id: 'mark',
    icon: '=',
    group: 'Формат',
    label: 'Выделение',
    snippet: '==|==',
    visual: '==выделение==',
  },
];

export { CMDS };

export function filterCmds(query: string): Cmd[] {
  const q = query.toLowerCase();
  return CMDS.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q) ||
      (c.search ?? '').toLowerCase().includes(q),
  );
}

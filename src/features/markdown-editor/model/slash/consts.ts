import type { Cmd } from './types';

const CMDS: Cmd[] = [
  { id: 'h1', icon: 'H1', group: 'Заголовки', label: 'Заголовок 1', snippet: '# ${}' },
  { id: 'h2', icon: 'H2', group: 'Заголовки', label: 'Заголовок 2', snippet: '## ${}' },
  { id: 'h3', icon: 'H3', group: 'Заголовки', label: 'Заголовок 3', snippet: '### ${}' },
  { id: 'h4', icon: 'H4', group: 'Заголовки', label: 'Заголовок 4', snippet: '#### ${}' },
  { id: 'h5', icon: 'H5', group: 'Заголовки', label: 'Заголовок 5', snippet: '##### ${}' },
  { id: 'h6', icon: 'H6', group: 'Заголовки', label: 'Заголовок 6', snippet: '###### ${}' },
  {
    id: 'ul',
    icon: '•',
    svgIcon: 'list',
    group: 'Списки',
    label: 'Маркированный',
    snippet: '- ${}',
  },
  { id: 'ol', icon: '1.', group: 'Списки', label: 'Нумерованный', snippet: '1. ${}' },
  {
    id: 'todo',
    icon: '☐',
    svgIcon: 'list-check',
    group: 'Списки',
    label: 'Задача',
    snippet: '- [ ] ${}',
  },
  { id: 'quote', icon: '❝', group: 'Блоки', label: 'Цитата', snippet: '> ${}' },
  { id: 'code', icon: '<>', group: 'Блоки', label: 'Блок кода', snippet: '```${}\n${}\n```' },
  {
    id: 'detail',
    icon: '▸',
    svgIcon: 'chevron-down',
    group: 'Блоки',
    label: 'Детали / Спойлер',
    snippet: '<details>\n<summary>${Заголовок}</summary>\n\n${Содержание}\n\n</details>',
    search: 'details detail spoiler спойлер',
  },
  { id: 'hr', icon: '—', group: 'Блоки', label: 'Разделитель', snippet: '\n---\n${}' },
  {
    id: 'table',
    icon: '⊞',
    svgIcon: 'grid',
    group: 'Блоки',
    label: 'Таблица',
    snippet: '| ${Кол 1} | ${Кол 2} |\n|---|---|\n| ${} | ${} |',
  },
  {
    id: 'image',
    icon: 'IMG',
    group: 'Блоки',
    label: 'Изображение',
    snippet: '![${alt}](${url})',
    search: 'image img picture картинка фото',
  },
  {
    id: 'bold',
    icon: 'B',
    svgIcon: 'format-bold',
    group: 'Формат',
    label: 'Жирный',
    snippet: '**${}**',
  },
  { id: 'italic', icon: 'I', group: 'Формат', label: 'Курсив', snippet: '*${}*' },
  { id: 'strike', icon: 'S', group: 'Формат', label: 'Зачёркнутый', snippet: '~~${}~~' },
  { id: 'icode', icon: '`', group: 'Формат', label: 'Код в строке', snippet: '`${}`' },
  { id: 'mark', icon: '=', group: 'Формат', label: 'Выделение', snippet: '==${}==' },
  {
    id: 'link',
    icon: 'L',
    svgIcon: 'link-1',
    group: 'Формат',
    label: 'Ссылка',
    snippet: '[${текст}](${url})',
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

/**
 * MCP-инструменты для страницы Пространства.
 *
 * Модель оперирует человекочитаемыми путями вида `Проекты/Идеи/заметки.md`, а стор
 * Пространства — плоским списком {@link SpaceNode} со случайными id и `parentId`.
 * `resolvePath`/`nodePath` ниже — единственное место, где происходит это преобразование.
 *
 * Содержимое файлов не в React-состоянии, оно лежит в localStorage под ключами,
 * заскоупленными на workspaceId (см. `spaceReadContent`/`spaceSaveContent`/`spaceDeleteContent`
 * в SpaceStoreProvider). Поэтому фабрика принимает `state`, `dispatch` и `workspaceId` снаружи —
 * сам файл не дёргает хуки, чтобы его было легко покрыть юнит-тестами без рендера React-дерева.
 */

import type { Dispatch } from 'react';
import type { SpaceAction, SpaceNode, SpaceState } from '@/entities/space';
import { spaceDeleteContent, spaceReadContent, spaceSaveContent } from '@/app/providers/SpaceStoreProvider';
import { uid } from '@/shared/lib/uid';
import type { McpTool } from '@/shared/lib/mcp/types';
import { fail, ok } from '@/shared/lib/mcp/types';

/** Содержимое файла больше этого не отдаём модели целиком — только обрезанный кусок с пометкой. */
const MAX_READ_CHARS = 8000;

// ---------------------------------------------------------------------------
// Пути: SpaceNode[] (плоский список) <-> человекочитаемый путь через '/'.
// ---------------------------------------------------------------------------

/** Разбивает путь на сегменты, терпя ведущий/хвостовой '/' и лишние пробелы. */
function splitPath(raw: string): string[] {
  return raw
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitParentAndName(raw: string): { parentSegments: string[]; name: string } {
  const segments = splitPath(raw);
  return { parentSegments: segments.slice(0, -1), name: segments[segments.length - 1] ?? '' };
}

/** Полный путь узла, собранный обходом parentId вверх до корня. */
function nodePath(nodes: SpaceNode[], node: SpaceNode): string {
  const parts = [node.name];
  let pid = node.parentId;
  while (pid) {
    const parent = nodes.find((n) => n.id === pid);
    if (!parent) break;
    parts.unshift(parent.name);
    pid = parent.parentId;
  }
  return parts.join('/');
}

type Resolved = { ok: true; node: SpaceNode } | { ok: false; error: string };

/**
 * Разрешает человекочитаемый путь в узел, спускаясь по сегментам от корня.
 * Имена в пределах одной папки не обязаны быть уникальными (приложение это не запрещает),
 * поэтому при коллизии на любом сегменте возвращаем ошибку со списком совпадений вместо
 * того, чтобы угадывать нужный узел.
 */
function resolvePath(nodes: SpaceNode[], rawPath: string): Resolved {
  const segments = splitPath(rawPath);
  if (segments.length === 0) return { ok: false, error: 'Путь не указан.' };

  let parentId: string | null = null;
  let node: SpaceNode | undefined;
  const walked: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    // Промежуточные сегменты обязаны быть папками, последний — файл или папка.
    const candidates = nodes.filter(
      (n) => n.parentId === parentId && n.name === seg && (isLast || n.type === 'folder'),
    );

    if (candidates.length === 0) {
      const where = walked.length ? walked.join('/') : 'корне';
      return { ok: false, error: `Не найдено «${seg}» в ${where}. Проверь путь «${rawPath}».` };
    }
    if (candidates.length > 1) {
      const list = candidates
        .map((c) => `${c.type === 'folder' ? 'папка' : 'файл'} (id ${c.id}, создан ${c.createdAt})`)
        .join('; ');
      return {
        ok: false,
        error: `Путь «${rawPath}» неоднозначен: несколько совпадений для «${seg}» — ${list}. Уточни запрос.`,
      };
    }

    node = candidates[0];
    walked.push(seg);
    parentId = node.id;
  }

  return { ok: true, node: node! };
}

/** Все id потомков узла (файлы и папки рекурсивно) — как getDescendants в FileTree.tsx. */
function getDescendants(nodes: SpaceNode[], id: string): string[] {
  const direct = nodes.filter((n) => n.parentId === id).map((n) => n.id);
  return [...direct, ...direct.flatMap((cid) => getDescendants(nodes, cid))];
}

function buildTreeText(nodes: SpaceNode[]): string {
  if (nodes.length === 0) return '(Пространство пусто)';
  const lines: string[] = [];

  const walk = (parentId: string | null, depth: number) => {
    const children = nodes
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name, 'ru')));
    for (const n of children) {
      const indent = '  '.repeat(depth);
      const label = n.type === 'folder' ? `${n.name}/` : n.name;
      lines.push(`${indent}${label}  [${nodePath(nodes, n)}]`);
      if (n.type === 'folder') walk(n.id, depth + 1);
    }
  };

  walk(null, 0);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Аргументы
// ---------------------------------------------------------------------------

function strArg(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === 'string' ? v : '';
}

function optStrArg(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

// ---------------------------------------------------------------------------
// Фабрика инструментов
// ---------------------------------------------------------------------------

/**
 * Строит набор MCP-инструментов для текущего состояния Пространства.
 * Вызывающий (страница/хук) передаёт живые `state`/`dispatch` из useSpaceStore()
 * и `workspaceId` из useWorkspaceStore() — сам файл хуков не знает.
 */
export function createSpaceTools(
  state: SpaceState,
  dispatch: Dispatch<SpaceAction>,
  workspaceId: string,
): McpTool[] {
  return [
    {
      name: 'space_list_tree',
      description: 'Показывает всё дерево файлов и папок текущего Пространства с их путями.',
      inputSchema: { type: 'object', properties: {} },
      run: () => ok(buildTreeText(state.nodes)),
    },

    {
      name: 'space_read_file',
      description: 'Читает содержимое файла по пути.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Путь к файлу, например Проекты/заметки.md' } },
        required: ['path'],
      },
      run: (args) => {
        const path = strArg(args, 'path');
        const r = resolvePath(state.nodes, path);
        if (!r.ok) return fail(r.error);
        if (r.node.type !== 'file') return fail(`«${path}» — папка, а не файл.`);

        const content = spaceReadContent(r.node.id, workspaceId);
        const full = nodePath(state.nodes, r.node);
        if (content.length > MAX_READ_CHARS) {
          return ok(
            `Файл ${full} (обрезано: показано ${MAX_READ_CHARS} из ${content.length} символов):\n\n${content.slice(0, MAX_READ_CHARS)}`,
          );
        }
        return ok(`Файл ${full}:\n\n${content}`);
      },
    },

    {
      name: 'space_create_file',
      description:
        'Создаёт новый файл, опционально сразу с содержимым. Если имя не заканчивается на .md, расширение добавляется автоматически.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Путь нового файла, например Проекты/заметки.md' },
          content: { type: 'string', description: 'Необязательное начальное содержимое файла' },
        },
        required: ['path'],
      },
      run: (args) => {
        const path = strArg(args, 'path');
        const content = optStrArg(args, 'content');
        const { parentSegments, name } = splitParentAndName(path);
        if (!name) return fail('Путь не указывает на имя файла.');

        let parentId: string | null = null;
        if (parentSegments.length > 0) {
          const parentPath = parentSegments.join('/');
          const r = resolvePath(state.nodes, parentPath);
          if (!r.ok) {
            return fail(`Папка «${parentPath}» не найдена. Сначала создай её инструментом space_create_folder.`);
          }
          if (r.node.type !== 'folder') return fail(`«${parentPath}» — не папка.`);
          parentId = r.node.id;
        }

        // Тот же критерий, что в FileTree.tsx: расширение добавляется, только если имя ещё не .md.
        const finalName = name.endsWith('.md') ? name : `${name}.md`;
        const exists = state.nodes.some((n) => n.parentId === parentId && n.name === finalName);
        if (exists) {
          return fail(`Файл «${finalName}» уже существует по этому пути. Для перезаписи используй space_write_file.`);
        }

        const node: SpaceNode = { id: uid(), name: finalName, type: 'file', parentId, createdAt: new Date().toISOString() };
        dispatch({ type: 'ADD_NODE', node });
        if (content !== undefined) spaceSaveContent(node.id, content, workspaceId);

        const fullPath = [...parentSegments, finalName].join('/');
        return ok(`Создан файл ${fullPath}`);
      },
    },

    {
      name: 'space_write_file',
      description: 'Полностью перезаписывает содержимое существующего файла.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Путь к файлу' },
          content: { type: 'string', description: 'Новое содержимое целиком' },
        },
        required: ['path', 'content'],
      },
      destructive: true,
      run: (args) => {
        const path = strArg(args, 'path');
        const content = strArg(args, 'content');
        const r = resolvePath(state.nodes, path);
        if (!r.ok) return fail(r.error);
        if (r.node.type !== 'file') return fail(`«${path}» — папка, а не файл.`);

        spaceSaveContent(r.node.id, content, workspaceId);
        return ok(`Файл ${nodePath(state.nodes, r.node)} перезаписан (${content.length} симв.).`);
      },
    },

    {
      name: 'space_append_file',
      description: 'Дописывает текст в конец существующего файла, не трогая уже написанное.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Путь к файлу' },
          content: { type: 'string', description: 'Текст, который нужно дописать' },
        },
        required: ['path', 'content'],
      },
      run: (args) => {
        const path = strArg(args, 'path');
        const addition = strArg(args, 'content');
        const r = resolvePath(state.nodes, path);
        if (!r.ok) return fail(r.error);
        if (r.node.type !== 'file') return fail(`«${path}» — папка, а не файл.`);

        const prev = spaceReadContent(r.node.id, workspaceId);
        const sep = prev && !prev.endsWith('\n') ? '\n' : '';
        spaceSaveContent(r.node.id, prev + sep + addition, workspaceId);
        return ok(`Дописано в файл ${nodePath(state.nodes, r.node)} (+${addition.length} симв.).`);
      },
    },

    {
      name: 'space_create_folder',
      description: 'Создаёт новую папку.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Путь новой папки, например Проекты/Идеи' } },
        required: ['path'],
      },
      run: (args) => {
        const path = strArg(args, 'path');
        const { parentSegments, name } = splitParentAndName(path);
        if (!name) return fail('Путь не указывает на имя папки.');

        let parentId: string | null = null;
        if (parentSegments.length > 0) {
          const parentPath = parentSegments.join('/');
          const r = resolvePath(state.nodes, parentPath);
          if (!r.ok) {
            return fail(`Папка «${parentPath}» не найдена. Сначала создай её инструментом space_create_folder.`);
          }
          if (r.node.type !== 'folder') return fail(`«${parentPath}» — не папка.`);
          parentId = r.node.id;
        }

        const exists = state.nodes.some((n) => n.parentId === parentId && n.name === name);
        if (exists) return fail(`«${name}» уже существует по этому пути.`);

        const node: SpaceNode = { id: uid(), name, type: 'folder', parentId, createdAt: new Date().toISOString() };
        dispatch({ type: 'ADD_NODE', node });

        const fullPath = [...parentSegments, name].join('/');
        return ok(`Создана папка ${fullPath}`);
      },
    },

    {
      name: 'space_rename_node',
      description: 'Переименовывает файл или папку, не меняя её расположение.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Текущий путь узла' },
          name: { type: 'string', description: 'Новое имя (без пути)' },
        },
        required: ['path', 'name'],
      },
      run: (args) => {
        const path = strArg(args, 'path');
        const newNameRaw = strArg(args, 'name').trim();
        if (!newNameRaw) return fail('Новое имя не указано.');
        const r = resolvePath(state.nodes, path);
        if (!r.ok) return fail(r.error);

        const finalName = r.node.type === 'file' && !newNameRaw.endsWith('.md') ? `${newNameRaw}.md` : newNameRaw;
        const clash = state.nodes.some(
          (n) => n.id !== r.node.id && n.parentId === r.node.parentId && n.name === finalName,
        );
        if (clash) return fail(`«${finalName}» уже существует в этой папке.`);

        const oldPath = nodePath(state.nodes, r.node);
        dispatch({ type: 'RENAME_NODE', id: r.node.id, name: finalName });
        return ok(`Переименовано: ${oldPath} → ${finalName}`);
      },
    },

    {
      name: 'space_move_node',
      description: 'Переносит файл или папку в другую папку (или в корень Пространства).',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Путь перемещаемого узла' },
          to: { type: 'string', description: 'Путь папки назначения; пусто или "/" — корень Пространства' },
        },
        required: ['path', 'to'],
      },
      run: (args) => {
        const path = strArg(args, 'path');
        const to = strArg(args, 'to');
        const r = resolvePath(state.nodes, path);
        if (!r.ok) return fail(r.error);

        let targetParentId: string | null = null;
        let targetPathText = '(корень)';
        if (splitPath(to).length > 0) {
          const rt = resolvePath(state.nodes, to);
          if (!rt.ok) return fail(rt.error);
          if (rt.node.type !== 'folder') return fail(`«${to}» — не папка.`);
          targetParentId = rt.node.id;
          targetPathText = nodePath(state.nodes, rt.node);
        }

        if (targetParentId === r.node.id) return fail('Нельзя переместить папку саму в себя.');
        if (r.node.type === 'folder' && targetParentId) {
          const descendants = new Set(getDescendants(state.nodes, r.node.id));
          if (descendants.has(targetParentId)) {
            return fail('Нельзя переместить папку в её собственную вложенную папку.');
          }
        }

        const fromPath = nodePath(state.nodes, r.node);
        dispatch({ type: 'MOVE_NODE', id: r.node.id, parentId: targetParentId });
        return ok(`Перемещено: ${fromPath} → ${targetPathText}`);
      },
    },

    {
      name: 'space_delete_node',
      description: 'Удаляет файл или папку. При удалении папки безвозвратно удаляется всё её содержимое.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Путь удаляемого узла' } },
        required: ['path'],
      },
      destructive: true,
      run: (args) => {
        const path = strArg(args, 'path');
        const r = resolvePath(state.nodes, path);
        if (!r.ok) return fail(r.error);

        const descendants = r.node.type === 'folder' ? getDescendants(state.nodes, r.node.id) : [];
        // Зачищаем контент из localStorage: сам узел (если файл) и все файлы-потомки —
        // иначе после DELETE_NODE в сторе они останутся мусором в localStorage навсегда.
        if (r.node.type === 'file') spaceDeleteContent(r.node.id, workspaceId);
        for (const id of descendants) {
          const n = state.nodes.find((x) => x.id === id);
          if (n?.type === 'file') spaceDeleteContent(id, workspaceId);
        }

        const full = nodePath(state.nodes, r.node);
        dispatch({ type: 'DELETE_NODE', id: r.node.id, descendants });
        return ok(
          descendants.length > 0
            ? `Удалено: ${full} (и ${descendants.length} вложенных элементов)`
            : `Удалено: ${full}`,
        );
      },
    },

    {
      name: 'space_search',
      description: 'Ищет подстроку в именах файлов/папок и в содержимом файлов, возвращает совпадения с контекстом.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Что искать' },
          limit: { type: 'integer', description: 'Максимум результатов, по умолчанию 20' },
        },
        required: ['query'],
      },
      run: (args) => {
        const query = strArg(args, 'query').trim();
        if (!query) return fail('Пустой поисковый запрос.');
        const limitArg = args.limit;
        const limit = typeof limitArg === 'number' && limitArg > 0 ? Math.floor(limitArg) : 20;
        const q = query.toLowerCase();

        const results: string[] = [];
        for (const n of state.nodes) {
          if (results.length >= limit) break;
          const full = nodePath(state.nodes, n);

          if (n.name.toLowerCase().includes(q)) {
            results.push(`${full} — совпадение в имени`);
            continue; // не дублируем ещё и по содержимому того же узла
          }

          if (n.type === 'file') {
            const content = spaceReadContent(n.id, workspaceId);
            const idx = content.toLowerCase().indexOf(q);
            if (idx !== -1) {
              const from = Math.max(0, idx - 30);
              const to = Math.min(content.length, idx + q.length + 30);
              const snippet = `${from > 0 ? '…' : ''}${content.slice(from, to)}${to < content.length ? '…' : ''}`;
              results.push(`${full} — «${snippet}»`);
            }
          }
        }

        if (results.length === 0) return ok(`По запросу «${query}» ничего не найдено.`);
        return ok(results.join('\n'));
      },
    },
  ];
}

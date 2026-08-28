'use client';

import { useRef, useState } from 'react';
import { Modal, Input, toast } from 'mikro-ui';
import { useSpaceStore, spaceDeleteContent, type SpaceNode } from '@/entities/space';
import { useWorkspaceStore } from '@/entities/workspace';
import { uid } from '@/shared/lib/uid';
import { Icon } from '@/shared/ui/Icon';
import { cx } from '@/shared/lib/cx';
import styles from './FileTree.module.css';

interface FlatItem {
  node: SpaceNode;
  depth: number;
}

/** Заголовок раздела в корне дерева — разделяет папки досок и всё остальное. */
interface SectionItem {
  section: 'boards' | 'files';
}

type TreeItem = FlatItem | SectionItem;

const isSection = (item: TreeItem): item is SectionItem => 'section' in item;

function buildFlat(
  nodes: SpaceNode[],
  parentId: string | null,
  depth: number,
  expanded: string[],
): FlatItem[] {
  const children = nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'ru');
    });

  const out: FlatItem[] = [];
  for (const node of children) {
    out.push({ node, depth });
    if (node.type === 'folder' && expanded.includes(node.id)) {
      out.push(...buildFlat(nodes, node.id, depth + 1, expanded));
    }
  }
  return out;
}

/**
 * Корень дерева, разложенный на два раздела: сначала папки досок, потом всё, что пользователь
 * завёл сам.
 *
 * Вперемешку эти две группы читаются плохо: папок досок со временем становится много, они
 * растут сами и оттесняют вниз то, что человек создавал руками. Заголовки показываются, только
 * когда есть обе группы, — на пустом или однородном дереве они были бы шумом.
 */
function buildTree(nodes: SpaceNode[], expanded: string[]): TreeItem[] {
  const rootFlat = buildFlat(nodes, null, 0, expanded);

  // Поддерево идёт следом за своим корнем, поэтому раздел определяется по корневому узлу:
  // элемент нулевой глубины открывает новую группу, остальные наследуют текущую.
  const boards: FlatItem[] = [];
  const files: FlatItem[] = [];
  let bucket = files;

  for (const item of rootFlat) {
    if (item.depth === 0) bucket = item.node.origin?.kind === 'board' ? boards : files;
    bucket.push(item);
  }

  if (!boards.length || !files.length) return [...boards, ...files];
  return [{ section: 'boards' }, ...boards, { section: 'files' }, ...files];
}

const SECTION_LABEL: Record<SectionItem['section'], string> = {
  boards: 'Доски',
  files: 'Файлы',
};

function getDescendants(nodes: SpaceNode[], id: string): string[] {
  const direct = nodes.filter((n) => n.parentId === id).map((n) => n.id);
  return [...direct, ...direct.flatMap((cid) => getDescendants(nodes, cid))];
}

type CreateTarget = { parentId: string | null; type: 'file' | 'folder' };

/**
 * Узлы-зеркала доски: их имя и место в дереве ведёт доска, а не пользователь.
 *
 * Переименование или перенос такого узла синхронизация вернёт обратно через несколько сотен
 * миллисекунд, а удаление файла ноды — пересоздаст пустым, потеряв текст. Поэтому действия,
 * которые доска всё равно отменит, здесь просто не показываются.
 */
const isMirror = (node: SpaceNode) => !!node.origin;

/** Папку доски пользователь волен убрать в любое место дерева — её родителя доска не навязывает. */
const isPinnedInPlace = (node: SpaceNode) =>
  node.origin?.kind === 'frame' || node.origin?.kind === 'node';

const MIRROR_BADGE = {
  board: { icon: 'grid', title: 'Папка доски — имя и содержимое ведёт доска' },
  frame: { icon: 'column', title: 'Фрейм доски — имя и содержимое ведёт доска' },
} as const;

/** Sentinel `dropId` value meaning "drop at the workspace root", distinct from null = no target. */
const ROOT_DROP = '\u0000root';
/** How long the cursor must rest over a collapsed folder before it springs open mid-drag. */
const EXPAND_HOLD_MS = 650;

export function FileTree() {
  const { state, dispatch } = useSpaceStore();
  const { state: wsState } = useWorkspaceStore();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [creating, setCreating] = useState<CreateTarget | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  // Drag-and-drop: `dragId` is the node being dragged, `dropId` the highlighted target
  // (a folder id, ROOT_DROP for the root, or null for none).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const forbidden = useRef<Set<string>>(new Set()); // dragged node + its subtree — illegal targets
  const expandTimer = useRef<{ id: string; t: ReturnType<typeof setTimeout> } | null>(null);

  const items = buildTree(state.nodes, state.expanded);

  /** Resolve the folder a hovered row would drop into: folders take themselves, files their parent.
   *  Returns the target parentId (null = root) or undefined when the move is illegal. */
  const resolveDrop = (hoveredId: string | null): string | null | undefined => {
    if (!dragId) return undefined;
    let target: string | null;
    if (hoveredId === null) {
      target = null;
    } else {
      const node = state.nodes.find((n) => n.id === hoveredId);
      if (!node) return undefined;
      target = node.type === 'folder' ? node.id : node.parentId;
    }
    if (target !== null && forbidden.current.has(target)) return undefined; // into itself or its subtree
    return target;
  };

  const cancelExpand = () => {
    if (expandTimer.current) {
      clearTimeout(expandTimer.current.t);
      expandTimer.current = null;
    }
  };

  /** Spring a collapsed folder open after the cursor rests on it, so nested drops are reachable. */
  const scheduleExpand = (target: string | null) => {
    if (target === null || state.expanded.includes(target)) {
      cancelExpand();
      return;
    }
    if (expandTimer.current?.id === target) return;
    cancelExpand();
    expandTimer.current = {
      id: target,
      t: setTimeout(() => {
        dispatch({ type: 'TOGGLE_FOLDER', id: target });
        expandTimer.current = null;
      }, EXPAND_HOLD_MS),
    };
  };

  const endDrag = () => {
    setDragId(null);
    setDropId(null);
    forbidden.current = new Set();
    cancelExpand();
  };

  const onRowDragStart = (e: React.DragEvent, node: SpaceNode) => {
    setDragId(node.id);
    forbidden.current = new Set([node.id, ...getDescendants(state.nodes, node.id)]);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
  };

  const targetFromEvent = (e: React.DragEvent) => {
    // Matched by attribute, not the (now CSS-Modules-scoped) '.tree-row' class name.
    const rowEl = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]');
    return resolveDrop(rowEl?.dataset.nodeId ?? null);
  };

  const onTreeDragOver = (e: React.DragEvent) => {
    if (!dragId) return;
    const target = targetFromEvent(e);
    if (target === undefined) {
      e.dataTransfer.dropEffect = 'none';
      setDropId(null);
      cancelExpand();
      return;
    }
    e.preventDefault(); // required to allow the drop
    e.dataTransfer.dropEffect = 'move';
    setDropId(target ?? ROOT_DROP);
    scheduleExpand(target);
  };

  const onTreeDragLeave = (e: React.DragEvent) => {
    // Only when the cursor actually leaves the tree, not when crossing between child rows.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDropId(null);
      cancelExpand();
    }
  };

  const onTreeDrop = (e: React.DragEvent) => {
    if (!dragId) {
      endDrag();
      return;
    }
    const target = targetFromEvent(e);
    if (target !== undefined) {
      e.preventDefault();
      const dragged = state.nodes.find((n) => n.id === dragId);
      if (dragged && dragged.parentId !== target) {
        dispatch({ type: 'MOVE_NODE', id: dragId, parentId: target });
        if (target && !state.expanded.includes(target))
          dispatch({ type: 'TOGGLE_FOLDER', id: target });
      }
    }
    endDrag();
  };

  const openCreate = (parentId: string | null, type: 'file' | 'folder') => {
    setNewName('');
    setCreating({ parentId, type });
  };

  const confirmCreate = () => {
    const name = newName.trim();
    if (!creating || !name) return;
    const node: SpaceNode = {
      id: uid(),
      name: creating.type === 'file' && !name.endsWith('.md') ? `${name}.md` : name,
      type: creating.type,
      parentId: creating.parentId,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_NODE', node });
    if (node.type === 'file') dispatch({ type: 'OPEN_FILE', id: node.id });
    if (node.type === 'folder' && node.parentId)
      dispatch({ type: 'TOGGLE_FOLDER', id: node.parentId });
    setCreating(null);
  };

  const handleDelete = (node: SpaceNode) => {
    const label = node.type === 'folder' ? 'папку и всё её содержимое' : `файл «${node.name}»`;
    const descendants = node.type === 'folder' ? getDescendants(state.nodes, node.id) : [];

    // Сами зеркала удалить нельзя (кнопки нет), но папку доски можно унести в обычную папку —
    // и тогда её удаление заденет файлы нод. Доска их тут же создаст заново, уже пустыми,
    // поэтому предупреждаем: восстановить текст будет неоткуда.
    const mirrored = descendants.filter((id) =>
      state.nodes.some((n) => n.id === id && n.origin?.kind === 'node'),
    ).length;
    const warning = mirrored
      ? `\n\nВнутри ${mirrored} файл(ов) блоков доски. Доска создаст их заново пустыми — текст пропадёт.`
      : '';

    if (!confirm(`Удалить ${label}?${warning}`)) return;
    // clean up content from localStorage
    if (node.type === 'file') spaceDeleteContent(node.id, wsState.currentId);
    descendants.forEach((id) => {
      const n = state.nodes.find((x) => x.id === id);
      if (n?.type === 'file') spaceDeleteContent(id, wsState.currentId);
    });
    dispatch({ type: 'DELETE_NODE', id: node.id, descendants });
    if (state.openFileId === node.id || descendants.includes(state.openFileId ?? '')) {
      const remaining = state.nodes.find(
        (n) => n.type === 'file' && n.id !== node.id && !descendants.includes(n.id),
      );
      if (remaining) dispatch({ type: 'OPEN_FILE', id: remaining.id });
    }
    toast.success(`Удалено`);
  };

  const confirmRename = () => {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) return;
    dispatch({ type: 'RENAME_NODE', id: renaming.id, name });
    setRenaming(null);
  };

  return (
    <div className={styles['tree-wrap']}>
      {/* Sidebar header */}
      <div className={styles['tree-header']}>
        <span className={styles['tree-header-title']}>Пространство</span>
        <div className={styles['tree-header-actions']}>
          <button
            className={styles['tree-act-btn']}
            title="Новый файл"
            onClick={() => openCreate(null, 'file')}
          >
            +f
          </button>
          <button
            className={styles['tree-act-btn']}
            title="Новая папка"
            onClick={() => openCreate(null, 'folder')}
          >
            +d
          </button>
        </div>
      </div>

      {/* File tree */}
      <div
        className={`${styles['tree-body']}${dropId === ROOT_DROP ? ` ${styles['tree-body--drop-root']}` : ''}`}
        onDragOver={onTreeDragOver}
        onDragLeave={onTreeDragLeave}
        onDrop={onTreeDrop}
        onDragEnd={endDrag}
      >
        {items.length === 0 && (
          <div className={styles['tree-empty']}>Нажми +f чтобы создать файл</div>
        )}

        {items.map((item) => {
          if (isSection(item)) {
            return (
              <div key={`section-${item.section}`} className={styles['tree-section']}>
                {SECTION_LABEL[item.section]}
              </div>
            );
          }

          const { node, depth } = item;
          const isOpen = state.openFileId === node.id;
          const isExpand = state.expanded.includes(node.id);
          const hover = hoverId === node.id;
          const isDrop = node.type === 'folder' && dropId === node.id;
          const isDragged = dragId === node.id;
          const mirror = isMirror(node);
          const badge = node.origin && MIRROR_BADGE[node.origin.kind as keyof typeof MIRROR_BADGE];

          return (
            <div
              key={node.id}
              data-node-id={node.id}
              draggable={!isPinnedInPlace(node)}
              className={[
                styles['tree-row'],
                isOpen && styles['tree-row--active'],
                node.type === 'folder' && styles['tree-row--folder'],
                isDrop && styles['tree-row--drop'],
                isDragged && styles['tree-row--dragging'],
                mirror && styles['tree-row--mirror'],
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ paddingLeft: 12 + depth * 14 }}
              onDragStart={(e) => onRowDragStart(e, node)}
              onClick={() => {
                if (node.type === 'folder') dispatch({ type: 'TOGGLE_FOLDER', id: node.id });
                else dispatch({ type: 'OPEN_FILE', id: node.id });
              }}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <span className={styles['tree-icon']}>
                {node.type === 'folder' ? (
                  <Icon
                    name="chevron-down"
                    size={9}
                    style={isExpand ? undefined : { transform: 'rotate(-90deg)' }}
                  />
                ) : (
                  <Icon name="file" size={9} />
                )}
              </span>
              <span className={styles['tree-name']} title={node.name}>
                {node.name}
              </span>

              {badge && (
                <span className={styles['tree-mirror-badge']} title={badge.title}>
                  <Icon name={badge.icon} size={9} />
                </span>
              )}

              {/* Кнопки строки рендерятся всегда, а прячет их разметка: на сенсорном
                  экране наведения нет, и по условию `hover` переименование с удалением
                  оказались бы недоступны вовсе. */}
              <div
                className={cx(styles['tree-row-actions'], hover && styles.shown)}
                onClick={(e) => e.stopPropagation()}
              >
                {node.type === 'folder' && (
                  <button
                    className={styles['tree-mini-btn']}
                    title="Файл внутри"
                    onClick={() => openCreate(node.id, 'file')}
                  >
                    <Icon name="add" size={10} />
                  </button>
                )}
                {!mirror && (
                  <>
                    <button
                      className={styles['tree-mini-btn']}
                      title="Переименовать"
                      onClick={() => setRenaming({ id: node.id, name: node.name })}
                    >
                      <Icon name="edit-01" size={10} />
                    </button>
                    <button
                      className={`${styles['tree-mini-btn']} ${styles.danger}`}
                      title="Удалить"
                      onClick={() => handleDelete(node)}
                    >
                      <Icon name="close" size={10} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create modal */}
      <Modal
        open={!!creating}
        onClose={() => setCreating(null)}
        title={creating?.type === 'file' ? 'Новый файл' : 'Новая папка'}
        size="sm"
      >
        <Input
          label="Название"
          placeholder={creating?.type === 'file' ? 'заметки.md' : 'Проекты'}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && confirmCreate()}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn-link ghost" onClick={() => setCreating(null)}>
            Отмена
          </button>
          <button className="btn-link" onClick={confirmCreate}>
            Создать
          </button>
        </div>
      </Modal>

      {/* Rename modal */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Переименовать" size="sm">
        <Input
          label="Новое название"
          value={renaming?.name ?? ''}
          onChange={(e) => renaming && setRenaming({ ...renaming, name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn-link ghost" onClick={() => setRenaming(null)}>
            Отмена
          </button>
          <button className="btn-link" onClick={confirmRename}>
            Сохранить
          </button>
        </div>
      </Modal>
    </div>
  );
}

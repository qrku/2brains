'use client';

import { useRef, useState } from 'react';
import { Modal, Input, toast } from 'mikro-ui';
import { useSpaceStore, spaceDeleteContent, type SpaceNode } from '@/entities/space';
import { useWorkspaceStore } from '@/entities/workspace';
import { uid } from '@/shared/lib/uid';
import { Icon } from '@/shared/ui/Icon';

interface FlatItem {
  node: SpaceNode;
  depth: number;
}

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

function getDescendants(nodes: SpaceNode[], id: string): string[] {
  const direct = nodes.filter((n) => n.parentId === id).map((n) => n.id);
  return [...direct, ...direct.flatMap((cid) => getDescendants(nodes, cid))];
}

type CreateTarget = { parentId: string | null; type: 'file' | 'folder' };

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

  const flat = buildFlat(state.nodes, null, 0, state.expanded);

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
    const rowEl = (e.target as HTMLElement).closest<HTMLElement>('.tree-row');
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
    if (!confirm(`Удалить ${label}?`)) return;
    const descendants = node.type === 'folder' ? getDescendants(state.nodes, node.id) : [];
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
    <div className="tree-wrap">
      {/* Sidebar header */}
      <div className="tree-header">
        <span className="tree-header-title">Пространство</span>
        <div className="tree-header-actions">
          <button
            className="tree-act-btn"
            title="Новый файл"
            onClick={() => openCreate(null, 'file')}
          >
            +f
          </button>
          <button
            className="tree-act-btn"
            title="Новая папка"
            onClick={() => openCreate(null, 'folder')}
          >
            +d
          </button>
        </div>
      </div>

      {/* File tree */}
      <div
        className={`tree-body${dropId === ROOT_DROP ? ' tree-body--drop-root' : ''}`}
        onDragOver={onTreeDragOver}
        onDragLeave={onTreeDragLeave}
        onDrop={onTreeDrop}
        onDragEnd={endDrag}
      >
        {flat.length === 0 && <div className="tree-empty">Нажми +f чтобы создать файл</div>}

        {flat.map(({ node, depth }) => {
          const isOpen = state.openFileId === node.id;
          const isExpand = state.expanded.includes(node.id);
          const hover = hoverId === node.id;
          const isDrop = node.type === 'folder' && dropId === node.id;
          const isDragged = dragId === node.id;

          return (
            <div
              key={node.id}
              data-node-id={node.id}
              draggable
              className={`tree-row${isOpen ? ' tree-row--active' : ''}${node.type === 'folder' ? ' tree-row--folder' : ''}${isDrop ? ' tree-row--drop' : ''}${isDragged ? ' tree-row--dragging' : ''}`}
              style={{ paddingLeft: 12 + depth * 14 }}
              onDragStart={(e) => onRowDragStart(e, node)}
              onClick={() => {
                if (node.type === 'folder') dispatch({ type: 'TOGGLE_FOLDER', id: node.id });
                else dispatch({ type: 'OPEN_FILE', id: node.id });
              }}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <span className="tree-icon">
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
              <span className="tree-name" title={node.name}>
                {node.name}
              </span>

              {hover && (
                <div className="tree-row-actions" onClick={(e) => e.stopPropagation()}>
                  {node.type === 'folder' && (
                    <button
                      className="tree-mini-btn"
                      title="Файл внутри"
                      onClick={() => openCreate(node.id, 'file')}
                    >
                      <Icon name="add" size={10} />
                    </button>
                  )}
                  <button
                    className="tree-mini-btn"
                    title="Переименовать"
                    onClick={() => setRenaming({ id: node.id, name: node.name })}
                  >
                    <Icon name="edit-01" size={10} />
                  </button>
                  <button
                    className="tree-mini-btn danger"
                    title="Удалить"
                    onClick={() => handleDelete(node)}
                  >
                    <Icon name="close" size={10} />
                  </button>
                </div>
              )}
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

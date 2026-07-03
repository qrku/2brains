'use client';

import { useState } from 'react';
import { Modal, Input, toast } from 'mikro-ui';
import { useSpaceStore, spaceDeleteContent } from '@/app/providers/SpaceStoreProvider';
import type { SpaceNode } from '@/entities/space';
import { uid } from '@/shared/lib/uid';

interface FlatItem { node: SpaceNode; depth: number }

function buildFlat(nodes: SpaceNode[], parentId: string | null, depth: number, expanded: string[]): FlatItem[] {
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

export function FileTree() {
  const { state, dispatch } = useSpaceStore();
  const [hoverId, setHoverId]     = useState<string | null>(null);
  const [creating, setCreating]   = useState<CreateTarget | null>(null);
  const [newName, setNewName]     = useState('');
  const [renaming, setRenaming]   = useState<{ id: string; name: string } | null>(null);

  const flat = buildFlat(state.nodes, null, 0, state.expanded);

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
    if (node.type === 'folder' && node.parentId) dispatch({ type: 'TOGGLE_FOLDER', id: node.parentId });
    setCreating(null);
  };

  const handleDelete = (node: SpaceNode) => {
    const label = node.type === 'folder' ? 'папку и всё её содержимое' : `файл «${node.name}»`;
    if (!confirm(`Удалить ${label}?`)) return;
    const descendants = node.type === 'folder' ? getDescendants(state.nodes, node.id) : [];
    // clean up content from localStorage
    if (node.type === 'file') spaceDeleteContent(node.id);
    descendants.forEach((id) => {
      const n = state.nodes.find((x) => x.id === id);
      if (n?.type === 'file') spaceDeleteContent(id);
    });
    dispatch({ type: 'DELETE_NODE', id: node.id, descendants });
    if (state.openFileId === node.id || descendants.includes(state.openFileId ?? '')) {
      const remaining = state.nodes.find((n) => n.type === 'file' && n.id !== node.id && !descendants.includes(n.id));
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
          <button className="tree-act-btn" title="Новый файл" onClick={() => openCreate(null, 'file')}>+f</button>
          <button className="tree-act-btn" title="Новая папка" onClick={() => openCreate(null, 'folder')}>+d</button>
        </div>
      </div>

      {/* File tree */}
      <div className="tree-body">
        {flat.length === 0 && (
          <div className="tree-empty">Нажми +f чтобы создать файл</div>
        )}

        {flat.map(({ node, depth }) => {
          const isOpen   = state.openFileId === node.id;
          const isExpand = state.expanded.includes(node.id);
          const hover    = hoverId === node.id;

          return (
            <div
              key={node.id}
              className={`tree-row${isOpen ? ' tree-row--active' : ''}${node.type === 'folder' ? ' tree-row--folder' : ''}`}
              style={{ paddingLeft: 12 + depth * 14 }}
              onClick={() => {
                if (node.type === 'folder') dispatch({ type: 'TOGGLE_FOLDER', id: node.id });
                else dispatch({ type: 'OPEN_FILE', id: node.id });
              }}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <span className="tree-icon">
                {node.type === 'folder' ? (isExpand ? '▾' : '▸') : '·'}
              </span>
              <span className="tree-name" title={node.name}>{node.name}</span>

              {hover && (
                <div className="tree-row-actions" onClick={(e) => e.stopPropagation()}>
                  {node.type === 'folder' && (
                    <button className="tree-mini-btn" title="Файл внутри" onClick={() => openCreate(node.id, 'file')}>+</button>
                  )}
                  <button className="tree-mini-btn" title="Переименовать" onClick={() => setRenaming({ id: node.id, name: node.name })}>✎</button>
                  <button className="tree-mini-btn danger" title="Удалить" onClick={() => handleDelete(node)}>✕</button>
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
          <button className="btn-link ghost" onClick={() => setCreating(null)}>Отмена</button>
          <button className="btn-link" onClick={confirmCreate}>Создать</button>
        </div>
      </Modal>

      {/* Rename modal */}
      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Переименовать"
        size="sm"
      >
        <Input
          label="Новое название"
          value={renaming?.name ?? ''}
          onChange={(e) => renaming && setRenaming({ ...renaming, name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn-link ghost" onClick={() => setRenaming(null)}>Отмена</button>
          <button className="btn-link" onClick={confirmRename}>Сохранить</button>
        </div>
      </Modal>
    </div>
  );
}

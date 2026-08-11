'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { PointerTracker } from '../model/usePointerTracker';
import type { BoardsStore } from '../model/useBoards';

interface Props {
  boards: BoardsStore;
  uiProps: PointerTracker['uiProps'];
}

export function BoardSwitcher({ boards, uiProps }: Props) {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setRenamingId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (renamingId) inputRef.current?.select();
  }, [renamingId]);

  const startRename = (id: string, name: string) => {
    setRenamingId(id);
    setDraft(name);
  };

  const commitRename = () => {
    if (renamingId) boards.rename(renamingId, draft);
    setRenamingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Удалить доску «${name}»? Всё, что на ней нарисовано, пропадёт.`)) return;
    boards.remove(id);
  };

  return (
    <div className="board-switch" ref={rootRef} {...uiProps}>
      <button
        className={`board-switch-trigger${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Доски"
      >
        <span className="board-switch-name">{boards.current?.name ?? '…'}</span>
        <Icon name="arrow-down-simple" size={10} />
      </button>

      {open && (
        <div className="board-switch-menu">
          {boards.boards.map((b) => (
            <div
              key={b.id}
              className={`board-switch-item${b.id === boards.current?.id ? ' active' : ''}`}
            >
              {renamingId === b.id ? (
                <input
                  ref={inputRef}
                  className="board-switch-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={commitRename}
                />
              ) : (
                <>
                  <button
                    className="board-switch-pick"
                    onClick={() => {
                      boards.select(b.id);
                      setOpen(false);
                    }}
                    onDoubleClick={() => startRename(b.id, b.name)}
                  >
                    {b.name}
                  </button>
                  <button
                    className="board-switch-act"
                    onClick={() => startRename(b.id, b.name)}
                    title="Переименовать"
                  >
                    <Icon name="edit-01" size={11} />
                  </button>
                  {boards.boards.length > 1 && (
                    <button
                      className="board-switch-act"
                      onClick={() => handleDelete(b.id, b.name)}
                      title="Удалить"
                    >
                      <Icon name="close" size={10} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          <div className="board-switch-divider" />

          <button
            className="board-switch-add"
            onClick={() => {
              boards.create();
              setOpen(false);
            }}
          >
            <Icon name="add" size={11} />
            Новая доска
          </button>
        </div>
      )}
    </div>
  );
}

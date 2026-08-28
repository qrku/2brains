'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { PointerTracker } from '../../../model/dragging/usePointerTracker';
import type { BoardsStore } from '../../../model/useBoards';
import { cx } from '@/shared/lib/cx';
import styles from './BoardSwitcher.module.css';

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
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setRenamingId(null);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
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
    <div className={styles['board-switch']} ref={rootRef} {...uiProps}>
      <button
        data-testid="board-switch-trigger"
        className={cx(styles['board-switch-trigger'], open && styles.active)}
        onClick={() => setOpen((v) => !v)}
        title="Доски"
      >
        <span className={styles['board-switch-name']}>{boards.current?.name ?? '…'}</span>
        <Icon name="arrow-down-simple" size={10} />
      </button>

      {open && (
        <div className={styles['board-switch-menu']}>
          {boards.boards.map((b) => (
            <div
              key={b.id}
              data-testid="board-switch-item"
              // Активность отдана атрибутом, а не только классом: класс хеширует
              // CSS Modules, и составной селектор в e2e по нему не собрать.
              data-active={b.id === boards.current?.id || undefined}
              className={cx(
                styles['board-switch-item'],
                b.id === boards.current?.id && styles.active,
              )}
            >
              {renamingId === b.id ? (
                <input
                  ref={inputRef}
                  data-testid="board-switch-input"
                  className={styles['board-switch-input']}
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
                    data-testid="board-switch-pick"
                    className={styles['board-switch-pick']}
                    onClick={() => {
                      boards.select(b.id);
                      setOpen(false);
                    }}
                    onDoubleClick={() => startRename(b.id, b.name)}
                  >
                    {b.name}
                  </button>
                  <button
                    data-testid="board-switch-rename"
                    className={styles['board-switch-act']}
                    onClick={() => startRename(b.id, b.name)}
                    title="Переименовать"
                  >
                    <Icon name="edit-01" size={11} />
                  </button>
                  {boards.boards.length > 1 && (
                    <button
                      data-testid="board-switch-delete"
                      className={styles['board-switch-act']}
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

          <div className={styles['board-switch-divider']} />

          <button
            data-testid="board-switch-add"
            className={styles['board-switch-add']}
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

'use client';

import type { BoardUsage } from '@/features/board-space-sync';
import { MarkdownEditor } from '@/features/markdown-editor';
import type { BoardNodeRef } from '@/entities/board';
import { Icon } from '@/shared/ui/Icon';
import { cx } from '@/shared/lib/cx';
import { useAsideWidth } from '../../model/useAsideWidth';
import styles from './NoteAside.module.css';

export interface NoteRef {
  id: string;
  name: string;
  /** Адрес ноды-владельца файла — по нему ищется, на каких досках он ещё используется. */
  origin?: BoardNodeRef;
  /** Нода открытой доски, из которой панель вызвали, — за ней панель следует при изменениях. */
  nodeId?: string;
}

interface Props {
  note: NoteRef | null;
  onClose: () => void;
  /** Доски, показывающие этот файл. Владелец идёт первым. */
  usage: BoardUsage[];
  /** Доска, открытая сейчас, — в списке она помечается вместо ссылки. */
  currentBoardId: string | null;
  onGoToBoard: (boardId: string) => void;
  /** Отвязать ноду, из которой открыта панель; передаётся только для связанной копии. */
  onUnlink?: () => void;
}

/**
 * Файл Пространства, открытый рядом с доской.
 *
 * Тот же редактор, что и на странице Пространства, — только без собственной панели: имя файла
 * и кнопки держит шапка. Правится файл везде одинаково, в том числе у связанных копий: файл у
 * них общий с оригиналом, и запрещать правку «не в оригинале» значило бы гонять человека между
 * досками ради того же самого документа. Вместо запрета — предупреждение, что файл общий.
 */
export function NoteAside({ note, onClose, usage, currentBoardId, onGoToBoard, onUnlink }: Props) {
  const { width, resizing, onResizeStart } = useAsideWidth();
  const shared = usage.length > 1;
  // Связанная нода с оборванным оригиналом общей уже не является, но отвязать её всё равно
  // нужно — иначе она останется ссылкой в никуда.
  const showBanner = shared || !!onUnlink;

  return (
    <aside
      className={cx(styles['board-aside'], note && styles.open, resizing && styles.resizing)}
      style={{ width }}
    >
      <div
        className={styles['ba-resizer']}
        onMouseDown={onResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Ширина панели"
      />

      <div className={styles['ba-header']}>
        <span className={styles['ba-title']}>{note?.name ?? ''}</span>
        <div className={styles['ba-actions']}>
          {note && (
            <a
              className={styles['ba-open-link']}
              href={`/space?file=${note.id}`}
              title="Открыть в Пространстве"
            >
              <Icon name="external-link" size={14} />
            </a>
          )}
          <button className={styles['ba-close']} onClick={onClose}>
            <Icon name="close" size={13} />
          </button>
        </div>
      </div>

      {showBanner && (
        <div className={styles['ba-shared']}>
          <Icon name="link-1" size={12} />
          <div className={styles['ba-shared-body']}>
            <div className={styles['ba-shared-title']}>
              {shared
                ? `Общий файл — правки увидят все ${usage.length} досок`
                : 'Связь оборвана: оригинала больше нет'}
            </div>

            {shared && (
              <div className={styles['ba-shared-boards']}>
                {usage.map((u) =>
                  u.boardId === currentBoardId ? (
                    <span key={u.boardId} className={styles['ba-board-current']}>
                      {u.boardName}
                      {u.owner && ' · оригинал'}
                    </span>
                  ) : (
                    <button
                      key={u.boardId}
                      className={styles['ba-board-link']}
                      onClick={() => onGoToBoard(u.boardId)}
                      title={`Перейти на доску «${u.boardName}»`}
                    >
                      {u.boardName}
                      {u.owner && ' · оригинал'}
                    </button>
                  ),
                )}
              </div>
            )}

            {onUnlink && (
              <button
                className={styles['ba-unlink']}
                onClick={onUnlink}
                title="Сделать самостоятельную копию: свой файл с копией текста"
              >
                <Icon name="flip" size={11} />
                Отвязать от оригинала
              </button>
            )}
          </div>
        </div>
      )}

      <div className={styles['ba-body']}>
        <MarkdownEditor fileId={note?.id ?? null} toolbar={false} emptyText="Файл не выбран" />
      </div>
    </aside>
  );
}

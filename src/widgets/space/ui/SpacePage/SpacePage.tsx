'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRegisterTools, createSpaceTools } from '@/features/ai-agent';
import { MarkdownEditor } from '@/features/markdown-editor';
import { useSpaceStore } from '@/entities/space';
import { useWorkspaceStore } from '@/entities/workspace';
import { Icon } from '@/shared/ui/Icon';
import { cx } from '@/shared/lib/cx';
import { FileTree } from '../FileTree/FileTree';
import styles from './SpacePage.module.css';

export function SpacePage() {
  // Инструменты Пространства доступны агенту, только пока открыта эта страница —
  // регистрация снимается при размонтировании.
  const { state, dispatch } = useSpaceStore();
  const { state: wsState } = useWorkspaceStore();
  const tools = useMemo(
    () => createSpaceTools(state, dispatch, wsState.currentId),
    [state, dispatch, wsState.currentId],
  );
  useRegisterTools('space', tools);

  /**
   * Дерево файлов на узком экране — выдвижная панель поверх редактора.
   *
   * Держать его колонкой нельзя: под дерево и текст одновременно там просто нет
   * ширины. Разметка прячет и кнопку, и подложку выше 720 px, поэтому состояние
   * живёт всегда и не зависит от замеров окна — на широком экране оно просто ни
   * на что не влияет.
   */
  const [treeOpen, setTreeOpen] = useState(false);

  // Выбранный файл закрывает панель: иначе открытый документ остаётся за ней, и
  // приходится закрывать дерево вторым действием. Первый рендер не считается —
  // на нём файл лишь восстанавливается из хранилища.
  const openFileId = state.openFileId;
  const seenFile = useRef(openFileId);
  useEffect(() => {
    if (openFileId !== seenFile.current) {
      seenFile.current = openFileId;
      setTreeOpen(false);
    }
  }, [openFileId]);

  return (
    <div className={styles['space-layout']}>
      {treeOpen && <div className={styles['space-backdrop']} onClick={() => setTreeOpen(false)} />}

      <aside className={cx(styles['space-sidebar'], treeOpen && styles.open)}>
        <FileTree />
      </aside>

      <main className={styles['space-main']}>
        {/* Кнопка живёт в странице, а не в панели редактора: она нужна и когда
            файл не выбран — тогда панели нет, а дерево открыть всё равно надо. */}
        <button
          type="button"
          className={styles['space-menu-btn']}
          aria-label={treeOpen ? 'Закрыть файлы' : 'Файлы'}
          aria-expanded={treeOpen}
          onClick={() => setTreeOpen((v) => !v)}
        >
          <Icon name={treeOpen ? 'close' : 'menu'} size={14} />
        </button>

        <MarkdownEditor fileId={state.openFileId} />
      </main>
    </div>
  );
}

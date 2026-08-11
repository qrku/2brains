'use client';

import { useMemo } from 'react';
import { useRegisterTools, createSpaceTools } from '@/features/ai-agent';
import { useSpaceStore } from '@/entities/space';
import { useWorkspaceStore } from '@/entities/workspace';
import { FileTree } from './FileTree';
import { MarkdownEditor } from './MarkdownEditor';

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

  return (
    <div className="space-layout">
      <aside className="space-sidebar">
        <FileTree />
      </aside>
      <main className="space-main">
        <MarkdownEditor />
      </main>
    </div>
  );
}

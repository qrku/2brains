'use client';

import { FileTree } from './FileTree';
import { MarkdownEditor } from './MarkdownEditor';

export function SpacePage() {
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

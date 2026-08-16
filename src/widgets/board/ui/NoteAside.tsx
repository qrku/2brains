'use client';

import { useCallback, useEffect, useState } from 'react';
import { spaceReadContent } from '@/entities/space';
import { useWorkspaceStore } from '@/entities/workspace';
import { parseMarkdown } from '@/shared/lib/markdown';
import { Icon } from '@/shared/ui/Icon';

export interface NoteRef {
  id: string;
  name: string;
}

const EMPTY_HTML = '<p style="color:var(--text-5)">Файл пустой</p>';

/** Read-only preview of a Space note referenced from a board node. */
export function NoteAside({ note, onClose }: { note: NoteRef | null; onClose: () => void }) {
  const { state: wsState } = useWorkspaceStore();
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!note) {
      setHtml('');
      return;
    }
    const md = spaceReadContent(note.id, wsState.currentId);
    setHtml(md ? parseMarkdown(md) : EMPTY_HTML);
  }, [note, wsState.currentId]);

  // Manual <details> toggle: native summary activation is unreliable inside this panel.
  const onBodyClick = useCallback((e: React.MouseEvent) => {
    const summary = (e.target as HTMLElement).closest('summary');
    if (!summary) return;
    e.preventDefault();
    const details = summary.closest('details');
    if (details) details.open = !details.open;
  }, []);

  return (
    <aside className={`board-aside${note ? ' open' : ''}`}>
      <div className="ba-header">
        <span className="ba-title">{note?.name ?? ''}</span>
        <div className="ba-actions">
          {note && (
            <a
              className="ba-open-link"
              href={`/space?file=${note.id}`}
              title="Открыть в Пространстве"
            >
              <Icon name="external-link" size={14} />
            </a>
          )}
          <button className="ba-close" onClick={onClose}>
            <Icon name="close" size={13} />
          </button>
        </div>
      </div>
      <div
        className="ba-body editor-preview"
        onClick={onBodyClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </aside>
  );
}

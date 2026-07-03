'use client';

import { Button } from 'mikro-ui';
import { usePrepStore } from '@/app/providers/PrepStoreProvider';
import { TopicRow } from '@/features/toggle-topic';
import { AddTopicForm } from '@/features/add-topic';
import type { Section } from '@/entities/section';

interface Props {
  section: Section;
}

export function SectionCard({ section }: Props) {
  const { state, dispatch } = usePrepStore();
  const isOpen = state.openIds.has(section.id);
  const done  = section.topics.filter((t) => state.doneIds.has(t.id)).length;
  const total = section.topics.length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="section">
      <div
        className="section-header"
        onClick={() => dispatch({ type: 'TOGGLE_OPEN', sectionId: section.id })}
      >
        <span className="section-name">{section.name}</span>
        <div className="mini-bar-bg">
          <div className="mini-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="section-meta">{done}/{total}</span>
        <span className={`chevron${isOpen ? ' open' : ''}`}>▾</span>
        <button
          className="icon-btn danger"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Удалить раздел «${section.name}»?`)) {
              dispatch({ type: 'DELETE_SECTION', sectionId: section.id });
            }
          }}
        >
          ✕
        </button>
      </div>

      {isOpen && (
        <div className="section-body">
          {section.topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} sectionId={section.id} />
          ))}
          <div className="add-topic-row">
            <AddTopicForm sectionId={section.id} />
          </div>
        </div>
      )}
    </div>
  );
}

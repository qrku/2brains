'use client';

import { Checkbox } from 'mikro-ui';
import { usePrepStore, type Topic } from '@/entities/section';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  topic: Topic;
  sectionId: string;
}

export function TopicRow({ topic, sectionId }: Props) {
  const { state, dispatch } = usePrepStore();
  const done = state.doneIds.has(topic.id);

  return (
    <div className="topic-row">
      <Checkbox
        checked={done}
        size="sm"
        onChange={() => dispatch({ type: 'TOGGLE_TOPIC', topicId: topic.id })}
        style={{ flex: 1, minWidth: 0 }}
      >
        <span className={done ? 'topic-name done' : 'topic-name'}>{topic.n}</span>
      </Checkbox>

      <div className="topic-row-end">
        {!done && topic.p === 'high' && <span className="priority p-high">важно</span>}
        {!done && topic.p === 'med'  && <span className="priority p-med">стоит</span>}
        <button
          className="icon-btn danger"
          onClick={() => dispatch({ type: 'DELETE_TOPIC', sectionId, topicId: topic.id })}
        >
          <Icon name="close" size={11} />
        </button>
      </div>
    </div>
  );
}

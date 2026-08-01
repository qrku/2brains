'use client';

import { parseMarkdown } from '@/shared/lib/markdown';
import type { MessageView } from '../model/agentReducer';
import { ToolCallCard } from './ToolCallCard';

interface Props {
  view: MessageView;
  onConfirm: () => void;
  onReject: () => void;
}

export function AgentMessage({ view, onConfirm, onReject }: Props) {
  if (view.role === 'user') {
    // Реплику пользователя markdown'ом не разбираем: показываем ровно то, что он напечатал.
    return <div className="agent-msg agent-msg--user">{view.text}</div>;
  }

  const empty = view.text.trim() === '';

  return (
    <div className="agent-msg agent-msg--assistant">
      {/* parseMarkdown экранирует HTML (см. esc в shared/lib/markdown) — тот же рендерер,
          что и у заметок Пространства, так что ответы выглядят так же, как файлы. */}
      {!empty && <div dangerouslySetInnerHTML={{ __html: parseMarkdown(view.text) }} />}

      {view.streaming && empty && (
        <span className="agent-msg-typing" aria-label="Агент печатает">
          <i /><i /><i />
        </span>
      )}

      {view.toolCalls.map((call) => (
        <ToolCallCard key={call.id} call={call} onConfirm={onConfirm} onReject={onReject} />
      ))}
    </div>
  );
}

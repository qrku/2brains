'use client';

import { parseMarkdown } from '@/shared/lib/markdown';
import type { MessageView } from '../../model/agentReducer';
import { ToolCallCard } from '../ToolCallCard/ToolCallCard';
import { cx } from '@/shared/lib/cx';
import styles from './AgentMessage.module.css';

interface Props {
  view: MessageView;
  onConfirm: () => void;
  onReject: () => void;
}

export function AgentMessage({ view, onConfirm, onReject }: Props) {
  if (view.role === 'user') {
    // Реплику пользователя markdown'ом не разбираем: показываем ровно то, что он напечатал.
    return <div className={cx(styles['agent-msg'], styles['agent-msg--user'])}>{view.text}</div>;
  }

  const empty = view.text.trim() === '';

  return (
    <div className={cx(styles['agent-msg'], styles['agent-msg--assistant'])}>
      {/* parseMarkdown экранирует HTML (esc) и фильтрует схемы ссылок (safeUrl) —
          текст здесь приходит от модели, то есть недоверенный. Тот же рендерер,
          что и у заметок Пространства, так что ответы выглядят так же, как файлы. */}
      {!empty && <div dangerouslySetInnerHTML={{ __html: parseMarkdown(view.text) }} />}

      {view.streaming && empty && (
        <span className={styles['agent-msg-typing']} aria-label="Агент печатает">
          <i />
          <i />
          <i />
        </span>
      )}

      {view.toolCalls.map((call) => (
        <ToolCallCard key={call.id} call={call} onConfirm={onConfirm} onReject={onReject} />
      ))}
    </div>
  );
}

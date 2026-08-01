'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { UseAgentChat } from '../model/useAgentChat';
import { AgentMessage } from './AgentMessage';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Состояние чата приходит сверху, а не из собственного useAgentChat: кружок показывает
   * индикатор занятости по тому же статусу, а панель размонтируется при закрытии —
   * свой экземпляр хука здесь терял бы переписку и раздваивал состояние.
   */
  chat: UseAgentChat;
}

export function AgentPanel({ open, onClose, chat }: Props) {
  const [draft, setDraft] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Автоскролл вниз: и на новые сообщения, и на каждую дельту стрима — иначе ответ
  // уезжает за нижний край, пока модель его дописывает.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.views, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const busy = chat.status === 'streaming';

  function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    chat.send(text);
    setDraft('');
  }

  return (
    <div className="agent-panel" role="dialog" aria-label="Ассистент">
      <div className="agent-panel-header">
        <span className="agent-panel-title">Агент</span>
        <span className="agent-panel-context">{chat.contextLabel}</span>
        <div style={{ flex: 1 }} />
        <button className="agent-panel-icon" title="Очистить переписку" onClick={chat.clear}>
          <Icon name="edit-01" size={11} />
        </button>
        <button className="agent-panel-icon" title="Закрыть" onClick={onClose}>
          <Icon name="close" size={11} />
        </button>
      </div>

      <div className="agent-panel-body" ref={bodyRef}>
        {chat.views.length === 0 && (
          <div className="agent-panel-empty">
            Спроси что-нибудь про свои заметки — или попроси создать файл.
          </div>
        )}

        {chat.views.map((view) => (
          <AgentMessage
            key={view.id}
            view={view}
            onConfirm={chat.confirm}
            onReject={chat.reject}
          />
        ))}

        {chat.status === 'error' && chat.errorText && (
          <div className="agent-panel-error">{chat.errorText}</div>
        )}
      </div>

      <div className="agent-panel-footer">
        <textarea
          ref={inputRef}
          className="agent-panel-input"
          rows={1}
          placeholder={busy ? 'Агент отвечает…' : 'Сообщение'}
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter отправляет, Shift+Enter — перенос строки.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
        />
        <button
          className="agent-panel-send"
          title="Отправить"
          disabled={busy || draft.trim() === ''}
          onClick={submit}
        >
          <Icon name="arrow-down-simple" size={11} />
        </button>
      </div>
    </div>
  );
}

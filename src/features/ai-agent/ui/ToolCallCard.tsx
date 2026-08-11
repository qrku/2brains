'use client';

import type { ToolCallView } from '../model/agentReducer';

/** Статус вызова → модификатор карточки. Отклонённый показываем как ошибку: действие не состоялось. */
const STATUS_MOD: Record<ToolCallView['status'], string> = {
  queued: '',
  running: '',
  'pending-confirm': ' agent-tool--pending',
  done: ' agent-tool--done',
  error: ' agent-tool--error',
  rejected: ' agent-tool--error',
};

const STATUS_LABEL: Record<ToolCallView['status'], string> = {
  queued: 'в очереди',
  running: 'выполняется…',
  'pending-confirm': 'нужно подтверждение',
  done: 'готово',
  error: 'ошибка',
  rejected: 'отклонено',
};

/** Аргументы приходят JSON-строкой от модели — форматируем, но битую строку показываем как есть. */
function formatArgs(argsText: string): string {
  try {
    return JSON.stringify(JSON.parse(argsText), null, 2);
  } catch {
    return argsText;
  }
}

interface Props {
  call: ToolCallView;
  onConfirm: () => void;
  onReject: () => void;
}

export function ToolCallCard({ call, onConfirm, onReject }: Props) {
  const awaiting = call.status === 'pending-confirm';

  return (
    <div className={`agent-tool${STATUS_MOD[call.status]}`}>
      <div className="agent-tool-head">
        <code className="agent-tool-name">{call.name}</code>
        <span className="agent-tool-status">{STATUS_LABEL[call.status]}</span>
      </div>

      <pre className="agent-tool-args">{formatArgs(call.argsText)}</pre>

      {awaiting && (
        <>
          <p className="agent-tool-warn">Действие изменит или удалит существующие данные.</p>
          <div className="agent-tool-actions">
            <button className="btn-link ghost" onClick={onReject}>
              Отклонить
            </button>
            <button className="btn-link" onClick={onConfirm}>
              Применить
            </button>
          </div>
        </>
      )}

      {!awaiting && call.resultText && <div className="agent-tool-result">{call.resultText}</div>}
    </div>
  );
}

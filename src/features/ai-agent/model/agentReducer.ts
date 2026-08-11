/**
 * Состояние панели чата ИИ-агента.
 *
 * Две параллельные структуры:
 * - `history: ChatMessage[]` — ровно то, что уходит на сервер (и в sessionStorage). Системное
 *   сообщение сюда никогда не попадает: оно собирается заново на каждую отправку через
 *   `buildSystemPrompt` (см. useAgentChat.ts), а не хранится.
 * - `views: MessageView[]` — то же самое, разложенное для отрисовки: стриминг текста по мере
 *   прихода дельт, карточки вызовов инструментов со своим статусом (queued/running/
 *   pending-confirm/done/error/rejected).
 *
 * Сам цикл вызова инструментов (fetch, разбор SSE, порядок выполнения) живёт в useAgentChat —
 * редьюсер только фиксирует уже принятые решения в структуру для рендера.
 */

import { uid } from '@/shared/lib/uid';
import type { ChatMessage, ToolCall } from '@/entities/agent';

export type AgentStatus = 'idle' | 'streaming' | 'waiting-confirm' | 'error';

export type ToolCallStatus = 'queued' | 'running' | 'pending-confirm' | 'done' | 'error' | 'rejected';

export interface ToolCallView {
  id: string;
  name: string;
  /** Аргументы вызова как прислала модель — сырая JSON-строка, для карточки. */
  argsText: string;
  destructive: boolean;
  status: ToolCallStatus;
  resultText?: string;
}

export interface UserMessageView {
  id: string;
  role: 'user';
  text: string;
}

export interface AssistantMessageView {
  id: string;
  role: 'assistant';
  text: string;
  /** Ассистент ещё дописывает этот месседж дельтами стрима. */
  streaming: boolean;
  toolCalls: ToolCallView[];
}

export type MessageView = UserMessageView | AssistantMessageView;

export interface AgentState {
  hydrated: boolean;
  history: ChatMessage[];
  views: MessageView[];
  status: AgentStatus;
  errorText?: string;
}

export type AgentAction =
  | { type: 'hydrate'; history: ChatMessage[] }
  | { type: 'user_message'; message: ChatMessage }
  | { type: 'assistant_delta'; delta: string }
  | { type: 'assistant_tool_calls'; message: ChatMessage; toolCalls: ToolCallView[] }
  | { type: 'assistant_done'; message: ChatMessage }
  | { type: 'tool_result'; message: ChatMessage; isError: boolean; rejected?: boolean }
  | { type: 'wait_confirm'; callId: string }
  | { type: 'resume' }
  | { type: 'error'; message: string }
  | { type: 'clear' };

export const initialAgentState: AgentState = {
  hydrated: false,
  history: [],
  views: [],
  status: 'idle',
};

/** Восстанавливает ленту сообщений из персистентной истории (после перезагрузки страницы). */
export function buildViewsFromHistory(history: ChatMessage[]): MessageView[] {
  const views: MessageView[] = [];

  for (const m of history) {
    if (m.role === 'user') {
      views.push({ id: uid(), role: 'user', text: m.content });
      continue;
    }

    if (m.role === 'assistant') {
      const toolCalls: ToolCallView[] = (m.tool_calls ?? []).map((c) => ({
        id: c.id,
        name: c.function.name,
        argsText: c.function.arguments,
        // Флаг destructive — свойство инструмента из реестра текущей страницы, не сообщения.
        // После перезагрузки восстановить его нельзя, но это и не нужно: sanitizeHistory
        // гарантирует, что у каждого сохранённого вызова уже есть ответ, так что статус ниже
        // терминальный и кнопки подтверждения такой карточке всё равно не покажутся.
        destructive: false,
        status: 'done',
      }));
      views.push({ id: uid(), role: 'assistant', text: m.content, streaming: false, toolCalls });
      continue;
    }

    if (m.role === 'tool') {
      const last = views[views.length - 1];
      if (last && last.role === 'assistant') {
        const tc = last.toolCalls.find((t) => t.id === m.tool_call_id);
        if (tc) tc.resultText = m.content;
      }
    }
  }

  return views;
}

/**
 * Убирает незавершённый хвост истории: если последний ассистентский месседж запросил
 * инструменты, а ответы на них (role: 'tool') пришли не на все — значит сессия оборвалась
 * посреди цикла (например, страницу закрыли до подтверждения разрушающего действия).
 * Отправлять такую историю дальше нельзя — сервер увидит вызовы без ответа и вернёт 400.
 */
export function sanitizeHistory(history: ChatMessage[]): ChatMessage[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== 'assistant') continue;

    if (m.tool_calls && m.tool_calls.length > 0) {
      const answered = new Set(
        history
          .slice(i + 1)
          .filter((x) => x.role === 'tool')
          .map((x) => x.tool_call_id),
      );
      const complete = m.tool_calls.every((c) => answered.has(c.id));
      return complete ? history : history.slice(0, i);
    }

    // Последний ассистентский месседж — обычный текстовый ответ, цикл завершился штатно.
    return history;
  }
  return history;
}

function patchToolCall(
  views: MessageView[],
  callId: string,
  patch: Partial<ToolCallView>,
): MessageView[] {
  return views.map((v) => {
    if (v.role !== 'assistant' || v.toolCalls.length === 0) return v;
    if (!v.toolCalls.some((t) => t.id === callId)) return v;
    return {
      ...v,
      toolCalls: v.toolCalls.map((t) => (t.id === callId ? { ...t, ...patch } : t)),
    };
  });
}

/** Дописывает дельту к стримящемуся ассистентскому сообщению, создавая его при необходимости. */
function appendDelta(views: MessageView[], delta: string): MessageView[] {
  const last = views[views.length - 1];
  if (last && last.role === 'assistant' && last.streaming) {
    return [...views.slice(0, -1), { ...last, text: last.text + delta }];
  }
  return [...views, { id: uid(), role: 'assistant', text: delta, streaming: true, toolCalls: [] }];
}

/** Финализирует текущее стримящееся сообщение (или создаёт новое), приложив итоговые данные. */
function finalizeAssistant(
  views: MessageView[],
  text: string,
  toolCalls: ToolCallView[],
): MessageView[] {
  const last = views[views.length - 1];
  if (last && last.role === 'assistant' && last.streaming) {
    return [...views.slice(0, -1), { ...last, text, streaming: false, toolCalls }];
  }
  return [...views, { id: uid(), role: 'assistant', text, streaming: false, toolCalls }];
}

export function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case 'hydrate':
      return {
        hydrated: true,
        history: action.history,
        views: buildViewsFromHistory(action.history),
        status: 'idle',
        errorText: undefined,
      };

    case 'user_message':
      return {
        ...state,
        history: [...state.history, action.message],
        views: [...state.views, { id: uid(), role: 'user', text: action.message.content }],
        status: 'streaming',
        errorText: undefined,
      };

    case 'assistant_delta':
      return { ...state, views: appendDelta(state.views, action.delta) };

    case 'assistant_tool_calls':
      return {
        ...state,
        history: [...state.history, action.message],
        views: finalizeAssistant(state.views, action.message.content, action.toolCalls),
      };

    case 'assistant_done':
      return {
        ...state,
        history: [...state.history, action.message],
        views: finalizeAssistant(state.views, action.message.content, []),
        status: 'idle',
      };

    case 'tool_result': {
      const callId = action.message.tool_call_id ?? '';
      const status: ToolCallStatus = action.rejected ? 'rejected' : action.isError ? 'error' : 'done';
      return {
        ...state,
        history: [...state.history, action.message],
        views: patchToolCall(state.views, callId, { status, resultText: action.message.content }),
      };
    }

    case 'wait_confirm':
      return {
        ...state,
        status: 'waiting-confirm',
        views: patchToolCall(state.views, action.callId, { status: 'pending-confirm' }),
      };

    case 'resume':
      return { ...state, status: 'streaming' };

    case 'error':
      return { ...state, status: 'error', errorText: action.message };

    case 'clear':
      return { hydrated: true, history: [], views: [], status: 'idle', errorText: undefined };

    default:
      return state;
  }
}

/** Реэкспорт для удобства импорта из хука/панели, чтобы не тянуть contract.ts напрямую всюду. */
export type { ChatMessage, ToolCall };

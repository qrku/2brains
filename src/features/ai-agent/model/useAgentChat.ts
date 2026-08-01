'use client';

/**
 * Хук панели чата ИИ-агента: ведёт цикл "отправить -> стримить текст -> (если нужно) вызвать
 * инструменты -> отправить результаты -> повторить", пока модель не перестанет запрашивать
 * инструменты или не будет достигнут лимит итераций.
 *
 * Источник истины для протокола во время цикла — `historyRef` (обычный `useRef`), а не React
 * state: между двумя фразами модели (fetch -> обработка вызовов -> следующий fetch) нет
 * ре-рендера, на который можно было бы положиться, чтобы прочитать актуальный `state.history`
 * из замыкания. `dispatch` в reducer — для отрисовки и для персиста в sessionStorage; ref —
 * для самого цикла.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAgentRegistry } from '@/app/providers/AgentStoreProvider';
import { useWorkspaceStore } from '@/app/providers/WorkspaceStoreProvider';
import { useSpaceStore } from '@/app/providers/SpaceStoreProvider';
import { DEFAULT_WORKSPACE } from '@/entities/workspace';
import type { SpaceNode } from '@/entities/space';
import { wsKey } from '@/shared/lib/workspace';
import type { McpRegistry } from '@/shared/lib/mcp/types';
import { buildSystemPrompt, type AgentContext } from './systemPrompt';
import { toToolSpec, type AgentChatRequest, type AgentStreamEvent, type ChatMessage, type ToolCall } from './contract';
import {
  agentReducer,
  initialAgentState,
  sanitizeHistory,
  type AgentStatus,
  type MessageView,
  type ToolCallStatus,
  type ToolCallView,
} from './agentReducer';

const STORAGE_BASE_KEY = 'agent_chat_history_v1';
const CHAT_ENDPOINT = '/api/agent/chat';
/** Лимит подряд идущих обращений к модели за один пользовательский запрос — от зацикливания. */
const MAX_ITERATIONS = 8;

const CONTEXT_LABEL: Record<AgentContext['page'], string> = {
  space: 'Пространство',
  board: 'Доска',
  other: 'Страница',
};

/** Путь открытого файла Пространства, собранный обходом parentId вверх до корня. */
function buildOpenFilePath(nodes: SpaceNode[], openFileId: string | null): string | undefined {
  if (!openFileId) return undefined;
  const node = nodes.find((n) => n.id === openFileId);
  if (!node) return undefined;
  const parts = [node.name];
  let pid = node.parentId;
  while (pid) {
    const parent = nodes.find((n) => n.id === pid);
    if (!parent) break;
    parts.unshift(parent.name);
    pid = parent.parentId;
  }
  return parts.join('/');
}

function isDestructive(registry: McpRegistry, call: ToolCall): boolean {
  return registry.listTools().find((t) => t.name === call.function.name)?.destructive === true;
}

/** Статусы карточек для только что полученного набора вызовов, в порядке их обработки цикла. */
function initialToolViews(calls: ToolCall[], registry: McpRegistry): ToolCallView[] {
  let stopped = false;
  return calls.map((c) => {
    const destructive = isDestructive(registry, c);
    let status: ToolCallStatus;
    if (stopped) status = 'queued';
    else if (destructive) {
      status = 'pending-confirm';
      stopped = true;
    } else status = 'running';
    return { id: c.id, name: c.function.name, argsText: c.function.arguments, destructive, status };
  });
}

async function executeCall(
  registry: McpRegistry,
  call: ToolCall,
): Promise<{ message: ChatMessage; isError: boolean }> {
  let args: Record<string, unknown> = {};
  const raw = call.function.arguments;
  if (raw && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      args = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {
        isError: true,
        message: {
          role: 'tool',
          tool_call_id: call.id,
          content: `Не удалось разобрать аргументы вызова «${call.function.name}»: некорректный JSON (${raw}).`,
        },
      };
    }
  }

  const result = await registry.callTool(call.function.name, args);
  const text = result.content.map((c) => c.text).join('\n');
  return {
    isError: !!result.isError,
    message: { role: 'tool', tool_call_id: call.id, content: text || '(пустой результат)' },
  };
}

function rejectedResult(call: ToolCall): { message: ChatMessage; isError: boolean } {
  return {
    isError: true,
    message: { role: 'tool', tool_call_id: call.id, content: 'Пользователь отклонил это действие.' },
  };
}

type StreamOutcome =
  | { kind: 'tool_calls'; text: string; calls: ToolCall[] }
  | { kind: 'done'; text: string }
  | { kind: 'error'; message: string }
  | { kind: 'aborted' };

/** Разбирает `text/event-stream`: буферизует чанки и режет по `\n`, храня неполный хвост. */
async function streamOneCompletion(
  history: ChatMessage[],
  ctx: AgentContext,
  registry: McpRegistry,
  onDelta: (delta: string) => void,
  signal: AbortSignal,
): Promise<StreamOutcome> {
  const tools = registry.listTools().map(toToolSpec);
  // Системное сообщение сюда не кладём: его собирает роут по `context`.
  const body: AgentChatRequest = { messages: history, tools, context: ctx };

  let response: Response;
  try {
    response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal.aborted) return { kind: 'aborted' };
    return { kind: 'error', message: e instanceof Error ? e.message : 'Не удалось связаться с сервером.' };
  }

  if (!response.ok || !response.body) {
    let message = `Сервер вернул ошибку (${response.status}).`;
    try {
      const data: unknown = await response.json();
      const err = (data as { error?: string } | null)?.error;
      if (err) message = err;
    } catch {
      // тело не JSON — оставляем сообщение по умолчанию
    }
    return { kind: 'error', message };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  const handleLine = (rawLine: string): StreamOutcome | null => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(':') || !line.startsWith('data:')) return null;
    const payload = line.slice(5).trim();
    if (!payload) return null;

    let event: AgentStreamEvent;
    try {
      event = JSON.parse(payload) as AgentStreamEvent;
    } catch {
      return null; // битая строка события — пропускаем, не роняем стрим
    }

    if (event.type === 'text') {
      text += event.delta;
      onDelta(event.delta);
      return null;
    }
    if (event.type === 'tool_calls') return { kind: 'tool_calls', text, calls: event.calls };
    if (event.type === 'done') return { kind: 'done', text };
    return { kind: 'error', message: event.message };
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const outcome = handleLine(line);
        if (outcome) return outcome;
      }
    }
  } catch (e) {
    if (signal.aborted) return { kind: 'aborted' };
    return { kind: 'error', message: e instanceof Error ? e.message : 'Поток ответа прервался.' };
  }

  // Дочитываем то, что осталось в буфере без завершающего \n.
  if (buffer) {
    const outcome = handleLine(buffer);
    if (outcome) return outcome;
  }

  return { kind: 'done', text };
}

async function processCalls(
  calls: ToolCall[],
  registry: McpRegistry,
  dispatch: React.Dispatch<Parameters<typeof agentReducer>[1]>,
  historyRef: React.MutableRefObject<ChatMessage[]>,
): Promise<{ paused: boolean; remaining: ToolCall[] }> {
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    if (isDestructive(registry, call)) {
      return { paused: true, remaining: calls.slice(i) };
    }
    const { message, isError } = await executeCall(registry, call);
    historyRef.current = [...historyRef.current, message];
    dispatch({ type: 'tool_result', message, isError });
  }
  return { paused: false, remaining: [] };
}

export interface UseAgentChat {
  views: MessageView[];
  messages: ChatMessage[];
  status: AgentStatus;
  errorText?: string;
  contextLabel: string;
  send: (text: string) => void;
  confirm: () => void;
  reject: () => void;
  clear: () => void;
}

export function useAgentChat(): UseAgentChat {
  const registry = useAgentRegistry();
  const pathname = usePathname();
  const { state: wsState } = useWorkspaceStore();
  const { state: spaceState } = useSpaceStore();

  const [state, dispatch] = useReducer(agentReducer, initialAgentState);

  const page: AgentContext['page'] = pathname?.startsWith('/board')
    ? 'board'
    : pathname?.startsWith('/space')
      ? 'space'
      : 'other';

  const workspace = wsState.workspaces.find((w) => w.id === wsState.currentId) ?? DEFAULT_WORKSPACE;
  const openFilePath = page === 'space' ? buildOpenFilePath(spaceState.nodes, spaceState.openFileId) : undefined;

  const ctx: AgentContext = useMemo(
    () => ({ page, workspaceName: workspace.name, openFilePath }),
    [page, workspace.name, openFilePath],
  );
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const storageKey = wsKey(STORAGE_BASE_KEY, wsState.currentId);

  const historyRef = useRef<ChatMessage[]>([]);
  const iterRef = useRef(0);
  const pendingCallsRef = useRef<ToolCall[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Хидратация из sessionStorage при монтировании и при смене воркспейса (значит, и ключа).
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    iterRef.current = 0;
    pendingCallsRef.current = null;

    let history: ChatMessage[] = [];
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) history = sanitizeHistory(JSON.parse(raw) as ChatMessage[]);
    } catch {
      history = [];
    }
    historyRef.current = history;
    dispatch({ type: 'hydrate', history });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ключ полностью определяет содержимое, dispatch стабилен
  }, [storageKey]);

  // Персист истории — только после того как хидратация отработала, иначе затрём сохранённое пустым стартовым состоянием.
  useEffect(() => {
    if (!state.hydrated) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state.history));
    } catch {
      // sessionStorage недоступен (приватный режим и т.п.) — переписка просто не переживёт reload
    }
  }, [state.hydrated, state.history, storageKey]);

  // Обрыв висящего стрима при размонтировании панели/страницы.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const loop = useCallback(async () => {
    while (iterRef.current < MAX_ITERATIONS) {
      iterRef.current += 1;
      const controller = new AbortController();
      abortRef.current = controller;

      const outcome = await streamOneCompletion(
        historyRef.current,
        ctxRef.current,
        registry,
        (delta) => dispatch({ type: 'assistant_delta', delta }),
        controller.signal,
      );

      if (outcome.kind === 'aborted') return;

      if (outcome.kind === 'error') {
        dispatch({ type: 'error', message: outcome.message });
        return;
      }

      if (outcome.kind === 'done') {
        const message: ChatMessage = { role: 'assistant', content: outcome.text };
        historyRef.current = [...historyRef.current, message];
        dispatch({ type: 'assistant_done', message });
        return;
      }

      // outcome.kind === 'tool_calls'
      const assistantMessage: ChatMessage = { role: 'assistant', content: outcome.text, tool_calls: outcome.calls };
      historyRef.current = [...historyRef.current, assistantMessage];
      dispatch({
        type: 'assistant_tool_calls',
        message: assistantMessage,
        toolCalls: initialToolViews(outcome.calls, registry),
      });

      const { paused, remaining } = await processCalls(outcome.calls, registry, dispatch, historyRef);
      if (paused) {
        pendingCallsRef.current = remaining;
        dispatch({ type: 'wait_confirm', callId: remaining[0].id });
        return;
      }
      // иначе продолжаем while — следующая итерация отправит обновлённую historyRef.current
    }

    dispatch({
      type: 'error',
      message: `Слишком много подряд идущих вызовов инструментов (лимит ${MAX_ITERATIONS}) — остановлено.`,
    });
  }, [registry]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (state.status === 'streaming' || state.status === 'waiting-confirm') return;

      const message: ChatMessage = { role: 'user', content: trimmed };
      historyRef.current = [...historyRef.current, message];
      dispatch({ type: 'user_message', message });
      // Лимит итераций ограничивает одну реплику, а не всю сессию: без сброса
      // счётчик копится и обычный девятый вопрос подряд упирается в потолок.
      // `respond()` его намеренно не трогает — подтверждение продолжает ту же реплику.
      iterRef.current = 0;
      void loop();
    },
    [state.status, loop],
  );

  const respond = useCallback(
    async (accept: boolean) => {
      const pending = pendingCallsRef.current;
      if (!pending || pending.length === 0) return;
      const [call, ...rest] = pending;
      pendingCallsRef.current = null;

      const { message, isError } = accept ? await executeCall(registry, call) : rejectedResult(call);
      historyRef.current = [...historyRef.current, message];
      dispatch({ type: 'tool_result', message, isError, rejected: !accept });

      const { paused, remaining } = await processCalls(rest, registry, dispatch, historyRef);
      if (paused) {
        pendingCallsRef.current = remaining;
        dispatch({ type: 'wait_confirm', callId: remaining[0].id });
        return;
      }

      dispatch({ type: 'resume' });
      await loop();
    },
    [registry, loop],
  );

  const confirm = useCallback(() => void respond(true), [respond]);
  const reject = useCallback(() => void respond(false), [respond]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    historyRef.current = [];
    iterRef.current = 0;
    pendingCallsRef.current = null;
    dispatch({ type: 'clear' });
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return {
    views: state.views,
    messages: state.history,
    status: state.status,
    errorText: state.errorText,
    contextLabel: CONTEXT_LABEL[page],
    send,
    confirm,
    reject,
    clear,
  };
}

/**
 * Тесты цикла вызова инструментов.
 *
 * Проверяем не «хук что-то вернул», а требования протокола, нарушение которых даёт 400 от API
 * на следующем же запросе: порядок сообщений и то, что каждый вызов получил ровно один ответ.
 */

import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';
import { renderHook, act, waitFor } from '@testing-library/react';

// jsdom не отдаёт TextEncoder/TextDecoder, а разбор SSE без них не работает.
Object.assign(global, {
  TextEncoder: global.TextEncoder ?? NodeTextEncoder,
  TextDecoder: global.TextDecoder ?? NodeTextDecoder,
});

import type { McpTool } from '@/shared/lib/mcp/types';
import { ok } from '@/shared/lib/mcp/types';
import type { AgentStreamEvent, ChatMessage, ToolCall } from './contract';
import { useAgentChat } from './useAgentChat';

/* ─── Моки окружения хука ──────────────────────────────────────────────────── */

let mockTools: McpTool[] = [];
const mockCallTool = jest.fn(
  async (name: string, _args: Record<string, unknown>) => ok(`выполнено: ${name}`),
);

jest.mock('next/navigation', () => ({ usePathname: () => '/space' }));

jest.mock('@/app/providers/AgentStoreProvider', () => ({
  useAgentRegistry: () => ({
    listTools: () => mockTools,
    callTool: (name: string, args: Record<string, unknown>) => mockCallTool(name, args),
    register: () => () => {},
  }),
}));

jest.mock('@/app/providers/WorkspaceStoreProvider', () => ({
  useWorkspaceStore: () => ({
    state: { hydrated: true, currentId: 'personal', workspaces: [{ id: 'personal', name: 'Personal' }] },
  }),
}));

jest.mock('@/app/providers/SpaceStoreProvider', () => ({
  useSpaceStore: () => ({
    state: { hydrated: true, nodes: [], openFileId: null, expanded: [] },
  }),
}));

/* ─── Хелперы ──────────────────────────────────────────────────────────────── */

function tool(name: string, destructive = false): McpTool {
  return {
    name,
    description: 'тестовый инструмент',
    inputSchema: { type: 'object', properties: {} },
    destructive,
    run: () => ok('не должен вызываться напрямую'),
  };
}

function call(id: string, name: string, args = '{"a":1}'): ToolCall {
  return { id, type: 'function', function: { name, arguments: args } };
}

/**
 * Тело SSE-ответа, нарезанное по 7 байт: границы чанков заведомо попадают в середину
 * JSON-строк, что и должен переживать разборщик.
 */
function sseBody(events: AgentStreamEvent[], chunkSize = 7) {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (offset >= bytes.length) return { done: true, value: undefined };
        const value = bytes.slice(offset, offset + chunkSize);
        offset += chunkSize;
        return { done: false, value };
      },
    }),
  };
}

/** Очередь ответов: каждый вызов fetch забирает следующий сценарий. */
function scriptFetch(responses: AgentStreamEvent[][]) {
  const queue = [...responses];
  const fetchMock = jest.fn(async () => {
    const events = queue.shift() ?? [{ type: 'done' } as AgentStreamEvent];
    return { ok: true, status: 200, body: sseBody(events) } as unknown as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const toolMessages = (messages: ChatMessage[]) => messages.filter((m) => m.role === 'tool');

beforeEach(() => {
  mockTools = [];
  mockCallTool.mockClear();
  sessionStorage.clear();
});

/* ─── Тесты ────────────────────────────────────────────────────────────────── */

test('текст собирается из дельт, разрезанных по границам чанков', async () => {
  scriptFetch([[
    { type: 'text', delta: 'Привет, ' },
    { type: 'text', delta: 'это длинный ответ модели.' },
    { type: 'done' },
  ]]);

  const { result } = renderHook(() => useAgentChat());
  act(() => result.current.send('привет'));

  await waitFor(() => expect(result.current.status).toBe('idle'));

  const assistant = result.current.views.find((v) => v.role === 'assistant');
  expect(assistant).toBeDefined();
  expect(assistant!.role === 'assistant' && assistant!.text).toBe('Привет, это длинный ответ модели.');
});

test('ассистентский месседж с tool_calls ложится в историю ПЕРЕД результатами инструментов', async () => {
  mockTools = [tool('space_list_tree')];
  scriptFetch([
    [{ type: 'tool_calls', calls: [call('c1', 'space_list_tree')] }],
    [{ type: 'text', delta: 'Готово.' }, { type: 'done' }],
  ]);

  const { result } = renderHook(() => useAgentChat());
  act(() => result.current.send('покажи дерево'));

  await waitFor(() => expect(result.current.status).toBe('idle'));

  const messages = result.current.messages;
  const assistantIdx = messages.findIndex((m) => m.role === 'assistant' && m.tool_calls?.length);
  const toolIdx = messages.findIndex((m) => m.role === 'tool');

  expect(assistantIdx).toBeGreaterThanOrEqual(0);
  expect(toolIdx).toBeGreaterThanOrEqual(0);
  // Порядок здесь — не стилистика: результат, стоящий раньше своего вызова, ломает следующий запрос.
  expect(assistantIdx).toBeLessThan(toolIdx);
});

test('каждый вызов получает ровно один ответ со своим tool_call_id', async () => {
  mockTools = [tool('space_list_tree'), tool('space_read_file')];
  scriptFetch([
    [{ type: 'tool_calls', calls: [call('c1', 'space_list_tree'), call('c2', 'space_read_file')] }],
    [{ type: 'done' }],
  ]);

  const { result } = renderHook(() => useAgentChat());
  act(() => result.current.send('прочитай файлы'));

  await waitFor(() => expect(result.current.status).toBe('idle'));

  const answers = toolMessages(result.current.messages);
  expect(answers).toHaveLength(2);
  expect(answers.map((m) => m.tool_call_id).sort()).toEqual(['c1', 'c2']);
});

test('разрушающий вызов ждёт подтверждения и не выполняется до него', async () => {
  mockTools = [tool('space_delete_node', true)];
  scriptFetch([
    [{ type: 'tool_calls', calls: [call('c1', 'space_delete_node')] }],
    [{ type: 'done' }],
  ]);

  const { result } = renderHook(() => useAgentChat());
  act(() => result.current.send('удали заметку'));

  await waitFor(() => expect(result.current.status).toBe('waiting-confirm'));
  expect(mockCallTool).not.toHaveBeenCalled();
});

test('отклонённое действие не выполняется, но всё равно получает ответ', async () => {
  mockTools = [tool('space_delete_node', true)];
  scriptFetch([
    [{ type: 'tool_calls', calls: [call('c1', 'space_delete_node')] }],
    [{ type: 'done' }],
  ]);

  const { result } = renderHook(() => useAgentChat());
  act(() => result.current.send('удали заметку'));
  await waitFor(() => expect(result.current.status).toBe('waiting-confirm'));

  await act(async () => { result.current.reject(); });
  await waitFor(() => expect(result.current.status).toBe('idle'));

  // Вызов без ответа уронил бы следующий запрос, поэтому отказ обязан стать сообщением.
  const answers = toolMessages(result.current.messages);
  expect(answers).toHaveLength(1);
  expect(answers[0].tool_call_id).toBe('c1');
  expect(mockCallTool).not.toHaveBeenCalled();
});

test('подтверждённое действие выполняется и цикл продолжается', async () => {
  mockTools = [tool('space_delete_node', true)];
  scriptFetch([
    [{ type: 'tool_calls', calls: [call('c1', 'space_delete_node')] }],
    [{ type: 'text', delta: 'Удалил.' }, { type: 'done' }],
  ]);

  const { result } = renderHook(() => useAgentChat());
  act(() => result.current.send('удали заметку'));
  await waitFor(() => expect(result.current.status).toBe('waiting-confirm'));

  await act(async () => { result.current.confirm(); });
  await waitFor(() => expect(result.current.status).toBe('idle'));

  expect(mockCallTool).toHaveBeenCalledWith('space_delete_node', { a: 1 });
  expect(toolMessages(result.current.messages)).toHaveLength(1);
});

test('битый JSON в аргументах не роняет цикл', async () => {
  mockTools = [tool('space_read_file')];
  scriptFetch([
    [{ type: 'tool_calls', calls: [call('c1', 'space_read_file', '{сломано')] }],
    [{ type: 'done' }],
  ]);

  const { result } = renderHook(() => useAgentChat());
  act(() => result.current.send('прочитай'));

  await waitFor(() => expect(result.current.status).toBe('idle'));

  const answers = toolMessages(result.current.messages);
  expect(answers).toHaveLength(1);
  expect(answers[0].tool_call_id).toBe('c1');
  expect(mockCallTool).not.toHaveBeenCalled();
});

test('лимит итераций останавливает зациклившуюся модель', async () => {
  mockTools = [tool('space_list_tree')];
  // Модель бесконечно просит один и тот же инструмент — сценарии не кончаются.
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    body: sseBody([{ type: 'tool_calls', calls: [call(`c${Math.random()}`, 'space_list_tree')] }]),
  }) as unknown as Response);
  global.fetch = fetchMock as unknown as typeof fetch;

  const { result } = renderHook(() => useAgentChat());
  act(() => result.current.send('зациклись'));

  await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 5000 });
  expect(fetchMock).toHaveBeenCalledTimes(8);
});

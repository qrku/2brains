/**
 * Контракт между чатом в браузере и прокси `/api/agent/chat`.
 *
 * Формат сообщений — OpenAI-совместимый, ровно такой ждёт OpenRouter.
 * Роут ничего не интерпретирует: он добавляет ключ и стримит ответ обратно,
 * а инструменты выполняются на клиенте.
 */

import type { JsonSchema, McpTool } from '@/shared/lib/mcp/types';

export interface ToolCall {
  id: string;
  type: 'function';
  /** `arguments` — JSON-строка, а не объект: так его отдаёт модель. */
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** role === 'assistant': инструменты, которые модель просит вызвать. */
  tool_calls?: ToolCall[];
  /** role === 'tool': id вызова, на который отвечает это сообщение. */
  tool_call_id?: string;
}

export interface ToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

export interface AgentChatRequest {
  messages: ChatMessage[];
  tools: ToolSpec[];
}

/** События SSE-стрима из роута. Одно событие — одна строка `data: {...}`. */
export type AgentStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** Инструмент реестра → форма, которую понимает function calling. */
export function toToolSpec(tool: McpTool): ToolSpec {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

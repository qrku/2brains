/**
 * MCP-совместимый слой инструментов.
 *
 * Формы `inputSchema` и результата повторяют спецификацию Model Context Protocol,
 * поэтому набор инструментов можно будет отдать наружу через настоящий MCP-сервер,
 * не переписывая сами инструменты. Выполняются они пока в браузере: данные
 * Пространства и Доски лежат в localStorage, до которого сервер не дотянется.
 */

/** Подмножество JSON Schema, которого хватает для описания аргументов инструмента. */
export interface JsonSchema {
  type: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  default?: unknown;
}

export interface McpContent {
  type: 'text';
  text: string;
}

export interface McpToolResult {
  content: McpContent[];
  /** Ошибку возвращаем как результат, а не как throw: модель должна её увидеть и исправиться. */
  isError?: boolean;
}

export interface McpTool {
  /**
   * Имя с префиксом пространства имён: `space_create_file`, `board_add_node`.
   * Только [a-zA-Z0-9_-] и не длиннее 64 символов — ограничение формата function calling.
   */
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /**
   * Разрушающий вызов: удаление или перезапись существующих данных.
   * Такие вызовы уходят пользователю на подтверждение и запускаются только после «Применить».
   */
  destructive?: boolean;
  run(args: Record<string, unknown>): McpToolResult | Promise<McpToolResult>;
}

/**
 * Реестр инструментов текущей страницы. Страницы регистрируют свои наборы при монтировании,
 * поэтому модель видит только то, что применимо к тому месту, где открыт чат.
 */
export interface McpRegistry {
  listTools(): McpTool[];
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
  /** Возвращает функцию снятия регистрации — удобно вернуть прямо из useEffect. */
  register(namespace: string, tools: McpTool[]): () => void;
}

export const ok = (text: string): McpToolResult => ({ content: [{ type: 'text', text }] });

export const fail = (text: string): McpToolResult => ({
  content: [{ type: 'text', text }],
  isError: true,
});

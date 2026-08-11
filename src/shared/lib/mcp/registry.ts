/**
 * Реализация {@link McpRegistry}: страницы регистрируют свои наборы инструментов
 * при монтировании и снимают их при размонтировании, поэтому модель в чате видит
 * только то, что применимо к текущему месту (Доска / Пространство).
 */

import type { JsonSchema, McpRegistry, McpTool } from './types';
import { fail } from './types';

function typeMatches(schema: JsonSchema, v: unknown): boolean {
  switch (schema.type) {
    case 'string':
      return typeof v === 'string';
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'integer':
      return typeof v === 'number' && Number.isInteger(v);
    case 'boolean':
      return typeof v === 'boolean';
    case 'array':
      return Array.isArray(v);
    case 'object':
      return typeof v === 'object' && v !== null && !Array.isArray(v);
  }
}

/**
 * Проверяет аргументы по `inputSchema` до вызова `run`.
 *
 * Модель ошибается в аргументах регулярно, а инструменты читают их хелперами вида
 * `strArg`, которые молча подставляют `''` вместо пропущенного поля — для
 * `space_write_file` это означало бы затирание файла вместо ошибки. Поэтому
 * `required` и типы проверяются здесь, один раз для всех инструментов.
 *
 * @returns текст ошибки для модели или `null`, если аргументы валидны.
 */
export function validateArgs(schema: JsonSchema, args: Record<string, unknown>): string | null {
  const props = schema.properties ?? {};

  for (const key of schema.required ?? []) {
    if (args[key] === undefined || args[key] === null) {
      return `не передан обязательный аргумент «${key}»`;
    }
  }

  for (const [key, prop] of Object.entries(props)) {
    const v = args[key];
    if (v === undefined || v === null) continue; // необязательное поле просто отсутствует
    if (!typeMatches(prop, v)) {
      return `аргумент «${key}» должен быть типа ${prop.type}, а пришло ${Array.isArray(v) ? 'array' : typeof v}`;
    }
  }

  return null;
}

export function createMcpRegistry(): McpRegistry {
  // namespace -> текущий набор инструментов этого namespace.
  // Namespace — это просто ключ регистрации (обычно имя страницы/фичи), у него
  // нет отдельной семантики за пределами группировки для register()/снятия.
  const byNamespace = new Map<string, McpTool[]>();

  const listTools = (): McpTool[] => Array.from(byNamespace.values()).flat();

  const register = (namespace: string, tools: McpTool[]): (() => void) => {
    byNamespace.set(namespace, tools);
    return () => {
      // Снимаем только если namespace всё ещё указывает на тот же набор —
      // иначе более поздняя регистрация того же namespace случайно стёрлась бы
      // отложенным cleanup-эффектом предыдущего владельца.
      if (byNamespace.get(namespace) === tools) {
        byNamespace.delete(namespace);
      }
    };
  };

  const callTool = async (
    name: string,
    args: Record<string, unknown>,
  ): ReturnType<McpRegistry['callTool']> => {
    const tool = listTools().find((t) => t.name === name);
    if (!tool) {
      return fail(
        `Инструмент «${name}» сейчас недоступен: возможно, страница уже сменилась. Обнови список инструментов и попробуй снова.`,
      );
    }
    const invalid = validateArgs(tool.inputSchema, args);
    if (invalid) {
      return fail(
        `Инструмент «${name}» вызван неверно: ${invalid}. Исправь аргументы и вызови снова.`,
      );
    }
    try {
      return await tool.run(args);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return fail(`Инструмент «${name}» упал с ошибкой: ${message}`);
    }
  };

  return { listTools, callTool, register };
}

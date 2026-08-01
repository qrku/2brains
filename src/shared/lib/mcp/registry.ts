/**
 * Реализация {@link McpRegistry}: страницы регистрируют свои наборы инструментов
 * при монтировании и снимают их при размонтировании, поэтому модель в чате видит
 * только то, что применимо к текущему месту (Доска / Пространство).
 */

import type { McpRegistry, McpTool } from './types';
import { fail } from './types';

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

  const callTool = async (name: string, args: Record<string, unknown>): ReturnType<McpRegistry['callTool']> => {
    const tool = listTools().find((t) => t.name === name);
    if (!tool) {
      return fail(`Инструмент «${name}» сейчас недоступен: возможно, страница уже сменилась. Обнови список инструментов и попробуй снова.`);
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

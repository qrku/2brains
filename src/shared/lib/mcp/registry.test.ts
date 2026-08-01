import { createMcpRegistry } from './registry';
import { ok, type McpTool } from './types';

const text = (r: { content: { text: string }[] }) => r.content[0].text;

function makeTool(run: jest.Mock): McpTool {
  return {
    name: 'demo_write',
    description: 'demo',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
        count: { type: 'number' },
        flag: { type: 'boolean' },
      },
      required: ['path', 'content'],
    },
    run,
  };
}

describe('registry — валидация аргументов по inputSchema', () => {
  it('не вызывает run, если обязательного аргумента нет', async () => {
    const run = jest.fn(() => ok('done'));
    const registry = createMcpRegistry();
    registry.register('demo', [makeTool(run)]);

    const r = await registry.callTool('demo_write', { path: 'a.md' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('content');
    expect(run).not.toHaveBeenCalled();
  });

  it('не вызывает run при неверном типе аргумента', async () => {
    const run = jest.fn(() => ok('done'));
    const registry = createMcpRegistry();
    registry.register('demo', [makeTool(run)]);

    const r = await registry.callTool('demo_write', { path: 'a.md', content: 42 });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('string');
    expect(run).not.toHaveBeenCalled();
  });

  it('проверяет типы и у необязательных аргументов', async () => {
    const run = jest.fn(() => ok('done'));
    const registry = createMcpRegistry();
    registry.register('demo', [makeTool(run)]);

    const r = await registry.callTool('demo_write', { path: 'a.md', content: 'x', count: 'нет' });
    expect(r.isError).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('пропускает корректный вызов, включая пустую строку и отсутствие необязательных', async () => {
    const run = jest.fn(() => ok('done'));
    const registry = createMcpRegistry();
    registry.register('demo', [makeTool(run)]);

    const r = await registry.callTool('demo_write', { path: 'a.md', content: '' });
    expect(r.isError).toBeFalsy();
    expect(run).toHaveBeenCalledWith({ path: 'a.md', content: '' });
  });

  it('ошибку из run по-прежнему возвращает как результат, а не бросает', async () => {
    const registry = createMcpRegistry();
    registry.register('demo', [makeTool(jest.fn(() => { throw new Error('boom'); }))]);

    const r = await registry.callTool('demo_write', { path: 'a.md', content: 'x' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('boom');
  });
});

import { boardReducer, initialBoardState } from '../boardReducer';
import type { BoardAction, BoardState } from '../types';
import type { BoardStore } from '../useBoardStore';
import type { McpTool, McpToolResult } from '@/shared/lib/mcp/types';
import { createBoardTools } from './agentTools';

/**
 * Minimal stand-in for `useBoardStore()`, built on the real `boardReducer` (no React involved) so
 * these tests exercise actual reducer behavior rather than mocked expectations. `dispatch` applies
 * synchronously and keeps `stateRef.current` in lockstep, mirroring what the real store eventually
 * converges to after React flushes — which is exactly what the tools' `waitFor`/`flush` polling
 * waits for.
 */
function makeStore(patch: Partial<BoardState> = {}): BoardStore {
  let state: BoardState = { ...initialBoardState, ready: true, ...patch };
  const stateRef = { current: state } as BoardStore['stateRef'];
  const dispatch = (action: BoardAction) => {
    state = boardReducer(state, action);
    stateRef.current = state;
  };
  return { state, dispatch, stateRef } as BoardStore;
}

function byName(tools: McpTool[], name: string): McpTool {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  return tool;
}

describe('createBoardTools', () => {
  it('board_add_node creates a node carrying the requested text', async () => {
    const store = makeStore();
    const tools = createBoardTools(store);
    const res = await byName(tools, 'board_add_node').run({ x: 100, y: 200, text: 'hello board' });

    expect(res.isError).toBeUndefined();
    expect(store.stateRef.current.nodes).toHaveLength(1);
    const node = store.stateRef.current.nodes[0];
    expect(node.text).toBe('hello board');
    expect(node.kind).toBe('box');
    expect(node.x).toBe(100);
    expect(node.y).toBe(200);
    // The returned id must be the one actually created.
    expect(res.content[0].text).toContain(node.id);
  });

  it('board_add_node rejects a non-numeric position without throwing', async () => {
    const store = makeStore();
    const tools = createBoardTools(store);
    const res = await byName(tools, 'board_add_node').run({ x: 'nope', y: 1 });

    expect(res.isError).toBe(true);
    expect(store.stateRef.current.nodes).toHaveLength(0);
  });

  it('board_delete_nodes on a missing id fails gracefully instead of throwing or dispatching', async () => {
    const store = makeStore();
    const tools = createBoardTools(store);
    const res = await byName(tools, 'board_delete_nodes').run({ ids: ['does-not-exist'] });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/does-not-exist/);
  });

  it('board_delete_nodes removes an existing node', async () => {
    const store = makeStore();
    const tools = createBoardTools(store);
    const add = await byName(tools, 'board_add_node').run({ x: 0, y: 0 });
    const id = store.stateRef.current.nodes[0].id;
    expect(add.isError).toBeUndefined();

    const res = await byName(tools, 'board_delete_nodes').run({ ids: [id] });
    expect(res.isError).toBeUndefined();
    expect(store.stateRef.current.nodes).toHaveLength(0);
  });

  it('board_connect_nodes adds an edge between two existing nodes', async () => {
    const store = makeStore();
    const tools = createBoardTools(store);
    await byName(tools, 'board_add_node').run({ x: 0, y: 0 });
    await byName(tools, 'board_add_node').run({ x: 400, y: 0 });
    const [a, b] = store.stateRef.current.nodes;

    const res = await byName(tools, 'board_connect_nodes').run({ fromId: a.id, toId: b.id });

    expect(res.isError).toBeUndefined();
    expect(store.stateRef.current.edges).toHaveLength(1);
    const edge = store.stateRef.current.edges[0];
    expect(edge.fromId).toBe(a.id);
    expect(edge.toId).toBe(b.id);
  });

  it('board_connect_nodes rejects connecting a node to itself', async () => {
    const store = makeStore();
    const tools = createBoardTools(store);
    await byName(tools, 'board_add_node').run({ x: 0, y: 0 });
    const id = store.stateRef.current.nodes[0].id;

    const res = await byName(tools, 'board_connect_nodes').run({ fromId: id, toId: id });

    expect(res.isError).toBe(true);
    expect(store.stateRef.current.edges).toHaveLength(0);
  });

  it('board_resize_node rejects a negative size and leaves the node untouched', async () => {
    const store = makeStore();
    const tools = createBoardTools(store);
    await byName(tools, 'board_add_node').run({ x: 0, y: 0 });
    const before = store.stateRef.current.nodes[0];

    const res = await byName(tools, 'board_resize_node').run({
      id: before.id,
      width: -10,
      height: 40,
    });

    expect(res.isError).toBe(true);
    const after = store.stateRef.current.nodes[0];
    expect(after.w).toBe(before.w);
    expect(after.h).toBe(before.h);
  });

  it('board_resize_node grows a node to (about) the requested size', async () => {
    const store = makeStore();
    const tools = createBoardTools(store);
    await byName(tools, 'board_add_node').run({ x: 0, y: 0 });
    const id = store.stateRef.current.nodes[0].id;

    const res = await byName(tools, 'board_resize_node').run({ id, width: 300, height: 150 });

    expect(res.isError).toBeUndefined();
    const node = store.stateRef.current.nodes[0];
    expect(node.w).toBeCloseTo(300, 0);
    expect(node.h).toBeCloseTo(150, 0);
  });

  it('board_move_node relocates a node to (about) the requested position', async () => {
    const store = makeStore();
    const tools = createBoardTools(store);
    await byName(tools, 'board_add_node').run({ x: 0, y: 0 });
    const id = store.stateRef.current.nodes[0].id;

    const res = await byName(tools, 'board_move_node').run({ id, x: 500, y: 600 });

    expect(res.isError).toBeUndefined();
    const node = store.stateRef.current.nodes[0];
    expect(node.x).toBeCloseTo(500, 0);
    expect(node.y).toBeCloseTo(600, 0);
  });

  it('board_set_text overwrites the text of an existing node and is marked destructive', async () => {
    const store = makeStore();
    const tools = createBoardTools(store);
    await byName(tools, 'board_add_node').run({ x: 0, y: 0, text: 'old' });
    const id = store.stateRef.current.nodes[0].id;

    const tool = byName(tools, 'board_set_text');
    expect(tool.destructive).toBe(true);
    const res = await tool.run({ id, text: 'new' });

    expect(res.isError).toBeUndefined();
    expect(store.stateRef.current.nodes[0].text).toBe('new');
  });

  it('board_list_nodes reports every node with its id and text', () => {
    const store = makeStore({
      nodes: [
        {
          id: 'n1',
          x: 0,
          y: 0,
          w: 100,
          h: 50,
          text: 'first',
          kind: 'box',
          fontSize: 13,
          shape: 'rect',
        },
        {
          id: 'n2',
          x: 200,
          y: 0,
          w: 100,
          h: 50,
          text: 'second',
          kind: 'box',
          fontSize: 13,
          shape: 'rect',
        },
      ],
    });
    const tools = createBoardTools(store);
    // board_list_nodes never awaits anything, so it always returns synchronously.
    const res = byName(tools, 'board_list_nodes').run({}) as McpToolResult;
    const text = res.content[0].text;

    expect(text).toContain('n1');
    expect(text).toContain('first');
    expect(text).toContain('n2');
    expect(text).toContain('second');
  });
});

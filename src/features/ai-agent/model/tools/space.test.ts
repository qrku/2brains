import { createSpaceTools } from './space';
import { spaceReadContent, type SpaceAction, type SpaceNode, type SpaceState } from '@/entities/space';

const WS = 'test-ws';

/** Minimal mirror of the SpaceStoreProvider reducer, just enough for these tools to operate on. */
function reducer(state: SpaceState, action: SpaceAction): SpaceState {
  switch (action.type) {
    case 'ADD_NODE':
      return { ...state, nodes: [...state.nodes, action.node] };
    case 'DELETE_NODE': {
      const remove = new Set([action.id, ...action.descendants]);
      return { ...state, nodes: state.nodes.filter((n) => !remove.has(n.id)) };
    }
    case 'RENAME_NODE':
      return { ...state, nodes: state.nodes.map((n) => (n.id === action.id ? { ...n, name: action.name } : n)) };
    case 'MOVE_NODE':
      return { ...state, nodes: state.nodes.map((n) => (n.id === action.id ? { ...n, parentId: action.parentId } : n)) };
    default:
      return state;
  }
}

/**
 * Test harness: keeps a live `state` snapshot updated via the reducer above and rebuilds the
 * tool array against it before every call — mirroring how the real registry always operates
 * on a fresh proxy pointing at the latest render's state (see AgentStoreProvider.useRegisterTools).
 */
function makeHarness() {
  let state: SpaceState = { hydrated: true, nodes: [], openFileId: null, expanded: [] };
  const dispatch = (action: SpaceAction) => {
    state = reducer(state, action);
  };
  const call = (name: string, args: Record<string, unknown> = {}) => {
    const tool = createSpaceTools(state, dispatch, WS).find((t) => t.name === name);
    if (!tool) throw new Error(`no such tool: ${name}`);
    return tool.run(args);
  };
  return { call, dispatch, getState: () => state };
}

const text = (r: { content: { text: string }[] }) => r.content[0].text;

afterEach(() => {
  localStorage.clear();
});

describe('space tools', () => {
  it('resolves a nested path through several folders', async () => {
    const h = makeHarness();
    h.call('space_create_folder', { path: 'Проекты' });
    h.call('space_create_folder', { path: 'Проекты/Идеи' });
    h.call('space_create_file', { path: 'Проекты/Идеи/заметки.md', content: 'hello' });

    const r = await h.call('space_read_file', { path: 'Проекты/Идеи/заметки.md' });
    expect(r.isError).toBeFalsy();
    expect(text(r)).toContain('hello');
  });

  it('tolerates leading and trailing slashes in a path', async () => {
    const h = makeHarness();
    const created = await h.call('space_create_file', { path: '/заметки.md/' });
    expect(created.isError).toBeFalsy();
    expect(h.getState().nodes).toHaveLength(1);
    expect(h.getState().nodes[0].name).toBe('заметки.md');
  });

  it('fails with a list of matches when a path segment is ambiguous', async () => {
    const h = makeHarness();
    const dup1: SpaceNode = { id: 'a', name: 'Заметки', type: 'folder', parentId: null, createdAt: new Date().toISOString() };
    const dup2: SpaceNode = { id: 'b', name: 'Заметки', type: 'folder', parentId: null, createdAt: new Date().toISOString() };
    h.dispatch({ type: 'ADD_NODE', node: dup1 });
    h.dispatch({ type: 'ADD_NODE', node: dup2 });

    const r = await h.call('space_read_file', { path: 'Заметки/файл.md' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('неоднозначен');
    expect(text(r)).toContain(dup1.id);
    expect(text(r)).toContain(dup2.id);
  });

  it('refuses to create a file inside a folder that does not exist, without creating a chain silently', async () => {
    const h = makeHarness();
    const r = await h.call('space_create_file', { path: 'Нет такой папки/файл.md' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('не найдена');
    expect(h.getState().nodes).toHaveLength(0);
  });

  it('appends .md to a file name that does not already end with it', async () => {
    const h = makeHarness();
    await h.call('space_create_file', { path: 'notes' });
    expect(h.getState().nodes[0].name).toBe('notes.md');
  });

  it('rejects creating a file that already exists at the same path', async () => {
    const h = makeHarness();
    await h.call('space_create_file', { path: 'заметки.md' });
    const r = await h.call('space_create_file', { path: 'заметки.md' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('уже существует');
    expect(h.getState().nodes).toHaveLength(1);
  });

  it('cascades folder deletion to descendants and clears their stored content', async () => {
    const h = makeHarness();
    await h.call('space_create_folder', { path: 'Папка' });
    await h.call('space_create_file', { path: 'Папка/файл.md', content: 'секрет' });
    const fileNode = h.getState().nodes.find((n) => n.type === 'file')!;
    expect(spaceReadContent(fileNode.id, WS)).toBe('секрет');

    const r = await h.call('space_delete_node', { path: 'Папка' });
    expect(r.isError).toBeFalsy();
    expect(h.getState().nodes).toHaveLength(0);
    expect(spaceReadContent(fileNode.id, WS)).toBe('');
  });

  it('finds a substring inside file content and returns it with surrounding context', async () => {
    const h = makeHarness();
    await h.call('space_create_file', {
      path: 'дневник.md',
      content: 'Сегодня был отличный собес по алгоритмам.',
    });

    const r = await h.call('space_search', { query: 'собес' });
    expect(r.isError).toBeFalsy();
    expect(text(r)).toContain('дневник.md');
    expect(text(r)).toContain('собес');
  });

  it('refuses to write a file when content is missing instead of wiping it', async () => {
    const h = makeHarness();
    await h.call('space_create_file', { path: 'заметки.md', content: 'важное' });
    const fileNode = h.getState().nodes[0];

    const r = await h.call('space_write_file', { path: 'заметки.md' });
    expect(r.isError).toBe(true);
    expect(spaceReadContent(fileNode.id, WS)).toBe('важное');
  });

  it('refuses to append when content is missing', async () => {
    const h = makeHarness();
    await h.call('space_create_file', { path: 'заметки.md', content: 'важное' });
    const fileNode = h.getState().nodes[0];

    const r = await h.call('space_append_file', { path: 'заметки.md' });
    expect(r.isError).toBe(true);
    expect(spaceReadContent(fileNode.id, WS)).toBe('важное');
  });

  it('writes an empty string when it is passed explicitly', async () => {
    const h = makeHarness();
    await h.call('space_create_file', { path: 'заметки.md', content: 'важное' });
    const fileNode = h.getState().nodes[0];

    const r = await h.call('space_write_file', { path: 'заметки.md', content: '' });
    expect(r.isError).toBeFalsy();
    expect(spaceReadContent(fileNode.id, WS)).toBe('');
  });

  it('flags only write and delete as destructive', () => {
    const h = makeHarness();
    const names = createSpaceTools(h.getState(), h.dispatch, WS)
      .filter((t) => t.destructive)
      .map((t) => t.name)
      .sort();
    expect(names).toEqual(['space_delete_node', 'space_write_file']);
  });

  it('uses only lowercase letters, digits and underscores in tool names, prefixed with space_', () => {
    const h = makeHarness();
    for (const t of createSpaceTools(h.getState(), h.dispatch, WS)) {
      expect(t.name).toMatch(/^space_[a-z0-9_]+$/);
    }
  });
});

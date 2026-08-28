import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BNode } from '@/entities/board';
import { BoardNode, type NodeHandlers } from './BoardNode';

// BoardNode always calls useSlashMenu, which reaches into the SpaceStore context.
// These tests exercise render branches, not the slash menu, so stub the hook to an
// inert, closed menu and keep the component free of provider wiring.
jest.mock('../../../model/slashMenu/useSlashMenu', () => ({
  useSlashMenu: () => ({
    open: false,
    x: 0,
    y: 0,
    query: '',
    activeIndex: 0,
    files: [],
    insert: jest.fn(),
    close: jest.fn(),
    handleKeyDown: () => false,
  }),
}));

function makeNode(overrides: Partial<BNode> = {}): BNode {
  return {
    id: 'n1',
    x: 10,
    y: 20,
    w: 100,
    h: 60,
    text: '',
    kind: 'box',
    fontSize: 13,
    shape: 'rect',
    ...overrides,
  };
}

const handlers: NodeHandlers = {
  onDown: jest.fn(),
  onEdit: jest.fn(),
  onConnectorDown: jest.fn(),
  onResizeDown: jest.fn(),
  onTextInput: jest.fn(),
  onBlur: jest.fn(),
  onOpenNote: jest.fn(),
};

function renderNode(node: BNode) {
  const { container } = render(
    <BoardNode
      node={node}
      selected={false}
      soloSelected={false}
      editing={false}
      dropSide={null}
      handlers={handlers}
    />,
  );
  return container.firstChild as HTMLElement;
}

describe('BoardNode render branches', () => {
  describe('kind === "draw"', () => {
    const drawNode = makeNode({
      kind: 'draw',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      color: '#f00',
      strokeW: 3,
    });

    it('renders an <svg><path>, not a text block', () => {
      const root = renderNode(drawNode);
      expect(root.querySelector('svg')).toBeInTheDocument();
      expect(root.querySelector('svg path')).toBeInTheDocument();
      expect(root.querySelector('.board-node-text')).not.toBeInTheDocument();
    });

    it('renders no connector handles', () => {
      const root = renderNode(drawNode);
      expect(root.querySelectorAll('.board-handle')).toHaveLength(0);
    });
  });

  describe('centered content', () => {
    it('circle gets the "centered" class', () => {
      const root = renderNode(makeNode({ shape: 'circle' }));
      expect(root.querySelector('.node-content')).toHaveClass('centered');
    });

    it('diamond gets the "centered" class', () => {
      const root = renderNode(makeNode({ shape: 'diamond' }));
      expect(root.querySelector('.node-content')).toHaveClass('centered');
    });

    it('rect does not get the "centered" class', () => {
      const root = renderNode(makeNode({ shape: 'rect' }));
      expect(root.querySelector('.node-content')).not.toHaveClass('centered');
    });
  });

  describe('className composition', () => {
    it('adds "bk-text" for a text node', () => {
      const root = renderNode(makeNode({ kind: 'text' }));
      expect(root).toHaveClass('bk-text');
    });

    it('adds "sel" only when selected', () => {
      const { container } = render(
        <BoardNode
          node={makeNode()}
          selected
          soloSelected={false}
          editing={false}
          dropSide={null}
          handlers={handlers}
        />,
      );
      expect(container.firstChild).toHaveClass('sel');
    });

    it('adds "drop-target" when a dropSide is set', () => {
      const { container } = render(
        <BoardNode
          node={makeNode()}
          selected={false}
          soloSelected={false}
          editing={false}
          dropSide="n"
          handlers={handlers}
        />,
      );
      expect(container.firstChild).toHaveClass('drop-target');
    });

    it('carries the shape class', () => {
      expect(renderNode(makeNode({ shape: 'circle' }))).toHaveClass('shape-circle');
      expect(renderNode(makeNode({ shape: 'diamond' }))).toHaveClass('shape-diamond');
    });
  });

  describe('sizing', () => {
    it('a circle takes its height from node.w, ignoring node.h', () => {
      const root = renderNode(makeNode({ shape: 'circle', w: 100, h: 999 }));
      expect(root).toHaveStyle({ width: '100px', height: '100px' });
    });

    it('a non-circle takes its height from node.h', () => {
      const root = renderNode(makeNode({ shape: 'rect', w: 100, h: 60 }));
      expect(root).toHaveStyle({ width: '100px', height: '60px' });
    });
  });
});

describe('кнопка файла ноды', () => {
  const renderWith = (props: Partial<React.ComponentProps<typeof BoardNode>>) =>
    render(
      <BoardNode
        node={makeNode({ text: 'Кэширование' })}
        selected={false}
        soloSelected={false}
        editing={false}
        dropSide={null}
        handlers={handlers}
        {...props}
      />,
    );

  beforeEach(() => {
    (handlers.onOpenNote as jest.Mock).mockClear();
  });

  it('не показывается, пока у ноды нет файла', () => {
    const { container } = renderWith({});
    expect(container.querySelector('.node-file-btn')).not.toBeInTheDocument();
  });

  it('появляется, когда файл есть', () => {
    const { container } = renderWith({ fileId: 'f1', fileName: 'Кэширование.md' });
    expect(container.querySelector('.node-file-btn')).toBeInTheDocument();
  });

  it('прячется на время правки подписи, чтобы не перекрывать текст', () => {
    const { container } = renderWith({ fileId: 'f1', fileName: 'Кэширование.md', editing: true });
    expect(container.querySelector('.node-file-btn')).not.toBeInTheDocument();
  });

  it('открывает свой файл в панели', async () => {
    const user = userEvent.setup();
    const { container } = renderWith({ fileId: 'f1', fileName: 'Кэширование.md' });

    await user.click(container.querySelector('.node-file-btn')!);

    expect(handlers.onOpenNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'f1', name: 'Кэширование.md' }),
    );
  });

  it('нажатие не уходит в drag-машину доски', async () => {
    const user = userEvent.setup();
    const { container } = renderWith({ fileId: 'f1', fileName: 'Кэширование.md' });

    await user.click(container.querySelector('.node-file-btn')!);

    expect(handlers.onDown).not.toHaveBeenCalled();
  });
});

describe('связанная копия', () => {
  const linkedNode = makeNode({
    text: 'снимок при вставке',
    link: { boardId: 'b2', nodeId: 'x1' },
  });

  const renderLinked = (props: Partial<React.ComponentProps<typeof BoardNode>> = {}) =>
    render(
      <BoardNode
        node={linkedNode}
        selected={false}
        soloSelected={false}
        editing={false}
        dropSide={null}
        fileId="f1"
        fileName="Кэширование.md"
        handlers={handlers}
        {...props}
      />,
    );

  beforeEach(() => {
    (handlers.onOpenNote as jest.Mock).mockClear();
  });

  it('помечена классом и значком связи', () => {
    const { container } = renderLinked();

    expect(container.firstChild).toHaveClass('linked');
    expect(container.querySelector('.node-link-badge')).toBeInTheDocument();
  });

  it('подпись берётся из имени файла оригинала, а не из своего текста', () => {
    const { container, queryByText } = renderLinked();

    expect(container.textContent).toContain('Кэширование');
    expect(queryByText('снимок при вставке')).not.toBeInTheDocument();
  });

  it('оборванная связь показывает свой текст и помечается как сломанная', () => {
    const { container } = renderLinked({ fileId: undefined, fileName: undefined });

    expect(container.firstChild).toHaveClass('link-broken');
    expect(container.textContent).toContain('снимок при вставке');
  });

  it('открывает общий файл оригинала, передавая его адрес для поиска связей', async () => {
    const user = userEvent.setup();
    const { container } = renderLinked({ fileOrigin: { boardId: 'b2', nodeId: 'x1' } });

    await user.click(container.querySelector('.node-file-btn')!);

    expect(handlers.onOpenNote).toHaveBeenCalledWith({
      id: 'f1',
      name: 'Кэширование.md',
      origin: { boardId: 'b2', nodeId: 'x1' },
      // Нода открытой доски — по ней панель предлагает отвязку и следит за сменой файла.
      nodeId: 'n1',
    });
  });
});

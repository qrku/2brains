import { render } from '@testing-library/react';
import type { BNode } from '@/entities/board';
import { BoardNode, type NodeHandlers } from './BoardNode';

// BoardNode always calls useSlashMenu, which reaches into the SpaceStore context.
// These tests exercise render branches, not the slash menu, so stub the hook to an
// inert, closed menu and keep the component free of provider wiring.
jest.mock('../model/useSlashMenu', () => ({
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

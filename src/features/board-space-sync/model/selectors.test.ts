import type { BNode } from '@/entities/board';
import type { SpaceNode } from '@/entities/space';
import { buildMirrorIndex, mirrorNodeFor } from './selectors';

const spaceNode = (id: string, origin?: SpaceNode['origin']): SpaceNode => ({
  id,
  name: `${id}.md`,
  type: origin?.kind === 'node' ? 'file' : 'folder',
  parentId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  origin,
});

const boardNode = (id: string, extra: Partial<BNode> = {}): BNode => ({
  id,
  x: 0,
  y: 0,
  w: 100,
  h: 50,
  text: 'Нода',
  kind: 'box',
  fontSize: 13,
  shape: 'rect',
  ...extra,
});

const tree = [
  spaceNode('manual'),
  spaceNode('mine', { kind: 'node', boardId: 'b1', nodeId: 'n1' }),
  spaceNode('foreign', { kind: 'node', boardId: 'b2', nodeId: 'n9' }),
  spaceNode('frame-folder', { kind: 'frame', boardId: 'b2', frameId: 'f9' }),
];
const index = buildMirrorIndex(tree);

describe('mirrorNodeFor', () => {
  it('находит собственный файл ноды', () => {
    expect(mirrorNodeFor(index, 'b1', boardNode('n1'))?.id).toBe('mine');
  });

  it('у связанной копии отдаёт файл оригинала с другой доски', () => {
    const linked = boardNode('local', { link: { boardId: 'b2', nodeId: 'n9' } });

    expect(mirrorNodeFor(index, 'b1', linked)?.id).toBe('foreign');
  });

  it('связанный фрейм ищется среди папок, а не файлов', () => {
    const linkedFrame = boardNode('local', {
      kind: 'frame',
      link: { boardId: 'b2', nodeId: 'f9' },
    });

    expect(mirrorNodeFor(index, 'b1', linkedFrame)?.id).toBe('frame-folder');
  });

  it('оборванная связь не находит ничего', () => {
    const broken = boardNode('local', { link: { boardId: 'gone', nodeId: 'n1' } });

    expect(mirrorNodeFor(index, 'b1', broken)).toBeUndefined();
  });

  it('без открытой доски у обычной ноды файла нет', () => {
    expect(mirrorNodeFor(index, null, boardNode('n1'))).toBeUndefined();
  });

  it('ноды чужой доски не подхватываются по одному лишь id', () => {
    expect(mirrorNodeFor(index, 'b1', boardNode('n9'))).toBeUndefined();
  });
});

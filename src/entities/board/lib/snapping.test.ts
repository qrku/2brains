import { computeSnap } from './snapping';
import type { BNode, Rect } from '../model/types';

/** Minimal box node at (x,y) sized w×h — only the fields snapping reads. */
function box(x: number, y: number, w = 100, h = 60): BNode {
  return { id: `${x},${y}`, x, y, w, h, text: '', kind: 'box', fontSize: 13, shape: 'rect' };
}

const rect = (x: number, y: number, w = 100, h = 60): Rect => ({ x1: x, y1: y, x2: x + w, y2: y + h });

const THRESH = 6;

describe('computeSnap', () => {
  it('returns no correction and no guides when nothing is in range', () => {
    const r = computeSnap(rect(500, 500), [box(0, 0)], THRESH);
    expect(r).toEqual({ snapX: 0, snapY: 0, guides: [] });
  });

  it('snaps a left edge onto another left edge and draws a vertical guide', () => {
    // Moving box left edge at x=104, static left edge at x=100 → 4px away, within threshold.
    // The static is wider, so only the left edges line up (centre/right differ).
    const r = computeSnap(rect(104, 300), [box(100, 0, 140, 60)], THRESH);
    expect(r.snapX).toBe(-4);
    expect(r.snapY).toBe(0);
    const vertical = r.guides.filter((g) => g.axis === 'x');
    expect(vertical).toHaveLength(1);
    expect(vertical[0].pos).toBe(100);
  });

  it('snaps centre-to-centre on both axes independently', () => {
    // Static centred at (150, 130); moving 100×60 box whose centre lands ~3px off on each axis.
    const r = computeSnap(rect(103, 103), [box(100, 100)], THRESH);
    expect(r.snapX).toBe(-3);
    expect(r.snapY).toBe(-3);
    expect(r.guides.some((g) => g.axis === 'x')).toBe(true);
    expect(r.guides.some((g) => g.axis === 'y')).toBe(true);
  });

  it('shows top, centre and bottom lines when heights match', () => {
    // Same height (60); align tops with a 2px pull — centre and bottom then coincide too.
    const r = computeSnap(rect(400, 102, 100, 60), [box(100, 100, 100, 60)], THRESH);
    expect(r.snapY).toBe(-2);
    const horizontals = r.guides.filter((g) => g.axis === 'y').map((g) => g.pos).sort((a, b) => a - b);
    expect(horizontals).toEqual([100, 130, 160]);
  });

  it('picks the nearest of competing targets', () => {
    // Left edge 5px from one node, 2px from another → the 2px one wins.
    const r = computeSnap(rect(102, 300), [box(97, 0), box(100, 0)], THRESH);
    expect(r.snapX).toBe(-2);
  });
});

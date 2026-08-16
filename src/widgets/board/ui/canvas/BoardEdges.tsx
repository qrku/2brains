import type { BEdge, XY } from '@/entities/board';
import type { EdgeRender } from '../../model/geometry/useBoardGeometry';

/** Invisible fat stroke laid under each arrow so it can be grabbed without pixel-perfect aim. */
const HIT_STROKE_W = 16;

/** Arrowhead length (screen px) at scale 1; scaled with zoom so it tracks the nodes. */
const HEAD_LEN = 13;

/**
 * Screen-space arrowhead triangle at the last vertex, pointing along the final segment. Drawn as a
 * polygon (not an SVG marker) so its size can follow the zoom — a marker is tied to the fixed stroke
 * width and would stay the same size while everything else shrinks.
 */
function arrowHead(verts: XY[], size: number): string {
  const tip = verts[verts.length - 1];
  const prev = verts[verts.length - 2] ?? tip;
  const a = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  const cos = Math.cos(a),
    sin = Math.sin(a);
  const half = size * 0.42;
  const bx = tip.x - size * cos,
    by = tip.y - size * sin;
  return [
    `${tip.x},${tip.y}`,
    `${bx - half * sin},${by + half * cos}`,
    `${bx + half * sin},${by - half * cos}`,
  ].join(' ');
}

interface Props {
  arrows: EdgeRender[];
  selectedEdge: string | null;
  previewPath: string | null;
  pencilPath: string | null;
  penColor: string;
  penWidth: number;
  scale: number;
  onEdgeDown: (e: React.MouseEvent, edge: BEdge, verts: XY[]) => void;
  onBendDown: (e: React.MouseEvent, edgeId: string, index: number, origin: XY) => void;
  onBendDelete: (e: React.MouseEvent, edgeId: string, index: number) => void;
}

export function BoardEdges({
  arrows,
  selectedEdge,
  previewPath,
  pencilPath,
  penColor,
  penWidth,
  scale,
  onEdgeDown,
  onBendDown,
  onBendDelete,
}: Props) {
  const headSize = HEAD_LEN * Math.min(Math.max(scale, 0.4), 1.5);

  return (
    <svg className="board-svg" aria-hidden>
      {arrows.map(({ id, edge, verts, screenVerts, d }) => {
        const selected = selectedEdge === id;
        const color = selected ? 'var(--accent)' : 'var(--text-5)';
        return (
          <g key={id}>
            <path
              d={d}
              stroke="transparent"
              strokeWidth={HIT_STROKE_W}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseDown={(e) => onEdgeDown(e, edge, verts)}
            />
            <path
              d={d}
              stroke={color}
              strokeWidth={selected ? 2.5 : 1.75}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: 'none', transition: 'stroke 0.15s, stroke-width 0.15s' }}
            />
            <polygon
              points={arrowHead(screenVerts, headSize)}
              fill={color}
              style={{ pointerEvents: 'none', transition: 'fill 0.15s' }}
            />

            {selected &&
              edge.points.map((p, i) => (
                <circle
                  key={i}
                  // screenVerts[0] is the exit point, so bend i sits at i + 1.
                  cx={screenVerts[i + 1].x}
                  cy={screenVerts[i + 1].y}
                  r={5}
                  fill="var(--paper)"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  style={{ pointerEvents: 'all', cursor: 'grab' }}
                  onMouseDown={(e) => onBendDown(e, id, i, p)}
                  onDoubleClick={(e) => onBendDelete(e, id, i)}
                />
              ))}
          </g>
        );
      })}

      {previewPath && (
        <path
          d={previewPath}
          fill="none"
          stroke="var(--text-3)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          opacity={0.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {pencilPath && (
        <path
          d={pencilPath}
          fill="none"
          stroke={penColor}
          strokeWidth={penWidth * scale}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

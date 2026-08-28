export type NodeKind = 'box' | 'text' | 'draw' | 'frame';
export type NodeShape = 'rect' | 'diamond' | 'circle';
export type TextAlign = 'left' | 'center' | 'right';
export type Side = 'n' | 's' | 'e' | 'w';
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface XY {
  x: number;
  y: number;
}

/** Viewport transform: canvas → screen. */
export interface T {
  x: number;
  y: number;
  scale: number;
}

/** Указатель на ноду конкретной доски — адрес оригинала для связанных и скопированных нод. */
export interface BoardNodeRef {
  boardId: string;
  nodeId: string;
}

export interface BNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  kind: NodeKind;
  fontSize: number;
  shape: NodeShape;
  /**
   * Нода — связанная копия ноды другой доски: показывает её файл и правку не принимает.
   * Своего файла в Пространстве у такой ноды нет, она делит файл с оригиналом, поэтому
   * зеркало её пропускает. Ссылка всегда указывает на первоисточник, а не на промежуточную
   * связанную копию — иначе удаление середины цепочки рвало бы связь у концов.
   */
  link?: BoardNodeRef;
  /**
   * Откуда ноду скопировали как самостоятельный дубликат. Нужна ровно один раз — чтобы при
   * создании файла перенести в него содержимое оригинала; дальше это просто происхождение.
   */
  copiedFrom?: BoardNodeRef;
  align?: TextAlign; // undefined === 'left' (keeps older saved boards valid)
  points?: XY[]; // kind === 'draw': freehand stroke, normalized to 0..1 within the node's own box
  color?: string; // kind === 'draw'
  strokeW?: number; // kind === 'draw'
}

export interface BEdge {
  id: string;
  fromId: string;
  toId: string;
  fromSide?: Side;
  toSide?: Side;
  points: XY[];
}

export interface BoardDoc {
  nodes: BNode[];
  edges: BEdge[];
}

/** A board in the workspace's board list — the document itself is stored separately, by id. */
export interface BoardMeta {
  id: string;
  name: string;
  createdAt: string;
}

export interface BoardSettings {
  edgePan: boolean;
  edgePanThreshold: number;
  edgePanSpeed: number;
}

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

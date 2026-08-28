import type {
  BEdge,
  BNode,
  BoardDoc,
  BoardSettings,
  Guide,
  NodeShape,
  ResizeEdge,
  Side,
  T,
  TextAlign,
  XY,
} from '@/entities/board';

export type Tool = 'cursor' | 'hand' | 'box' | 'text' | 'frame' | 'pencil';

export type Drag =
  | { type: 'none' }
  | { type: 'pan'; startX: number; startY: number; ox: number; oy: number }
  | { type: 'nodes'; ids: string[]; startX: number; startY: number; origins: Record<string, XY> }
  | { type: 'select'; sx: number; sy: number; ex: number; ey: number }
  | { type: 'edge'; fromId: string; fromSide: Side; toSX: number; toSY: number }
  | { type: 'draw'; sx: number; sy: number; ex: number; ey: number }
  | { type: 'pencil'; points: XY[] }
  | {
      type: 'resize';
      id: string;
      edge: ResizeEdge;
      startX: number;
      startY: number;
      origin: { x: number; y: number; w: number; h: number };
    }
  | {
      type: 'edgePoint';
      edgeId: string;
      index: number;
      startX: number;
      startY: number;
      origin: XY;
    };

/** Как вставляется содержимое буфера, скопированное с другой доски. */
export type PasteMode = 'duplicate' | 'link';

/**
 * Буфер обмена доски. Помнит доску-источник: вставка на неё же — обычный дубликат, а вставка
 * на другую доску сначала спрашивает, нужен дубликат или связанная копия.
 */
export interface BoardClipboard extends BoardDoc {
  boardId: string;
}

export interface BoardState {
  ready: boolean;
  /** Доска, которую держит состояние; нужна буферу, чтобы отличить свою вставку от чужой. */
  boardId: string | null;
  nodes: BNode[];
  edges: BEdge[];
  view: T;
  selected: string[];
  selectedEdge: string | null;
  editing: string | null;
  drag: Drag;
  /** Live smart-alignment lines, populated only during a node drag. */
  guides: Guide[];
  tool: Tool;
  penColor: string;
  penWidth: number;
  settings: BoardSettings;
  clipboard: BoardClipboard | null;
}

/**
 * Pointer position as the drag machine needs it: `s` is relative to the viewport box
 * (what canvas maths wants), `client` is page-absolute (what drag deltas are anchored to).
 */
export interface PointerPos {
  sx: number;
  sy: number;
  clientX: number;
  clientY: number;
}

export type BoardAction =
  | {
      type: 'LOAD';
      boardId: string;
      nodes: BNode[];
      edges: BEdge[];
      settings: BoardSettings;
      view: T;
    }
  | { type: 'SET_VIEW'; view: T }
  | { type: 'PAN_BY'; dx: number; dy: number }
  | { type: 'ZOOM_AT'; factor: number; mx: number; my: number }
  | { type: 'FIT_VIEW'; width: number; height: number }
  | { type: 'FOCUS_NODE'; id: string; width: number; height: number }
  | { type: 'SET_TOOL'; tool: Tool }
  | { type: 'SELECT'; ids: string[] }
  | { type: 'SELECT_EDGE'; id: string | null }
  | { type: 'EDIT'; id: string | null }
  | { type: 'ADD_NODE'; pos: XY }
  | { type: 'SET_TEXT'; id: string; text: string }
  | { type: 'FONT_SIZE'; id: string; delta: number }
  | { type: 'SET_SHAPE'; id: string; shape: NodeShape }
  | { type: 'SET_ALIGN'; id: string; align: TextAlign }
  | { type: 'STROKE_COLOR'; id: string; color: string }
  | { type: 'STROKE_WIDTH'; id: string; delta: number }
  | { type: 'SET_PEN_COLOR'; color: string }
  | { type: 'PEN_WIDTH'; delta: number }
  | { type: 'ADD_EDGE_BEND'; edgeId: string; index: number; pt: XY }
  | { type: 'DELETE_EDGE_POINT'; edgeId: string; index: number }
  | { type: 'DELETE_SELECTION' }
  | { type: 'COPY' }
  | { type: 'PASTE'; at: XY | null; mode: PasteMode }
  /**
   * Разрывает связь у перечисленных нод, превращая их в самостоятельные копии.
   * `text` приходит снаружи: у связанной ноды подпись берётся из имени файла оригинала, а
   * после отвязки её ведёт собственный `text` — без него нода вернулась бы к снимку,
   * сделанному при вставке, и новый файл получил бы устаревшее имя.
   */
  | { type: 'UNLINK'; items: { id: string; text: string }[] }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<BoardSettings> }
  | { type: 'DRAG_START'; drag: Drag }
  | { type: 'DRAG_MOVE'; pos: PointerPos }
  | { type: 'DRAG_END'; pos: PointerPos }
  /** Жест оборван системой или вторым пальцем — в отличие от DRAG_END ничего не создаёт. */
  | { type: 'DRAG_CANCEL' };

export type {
  BNode,
  BEdge,
  BoardDoc,
  BoardNodeRef,
  BoardMeta,
  BoardSettings,
  NodeKind,
  NodeShape,
  Rect,
  ResizeEdge,
  Side,
  T,
  TextAlign,
  XY,
} from './model/types';

export type { Guide, ResizeSnapResult, SnapResult } from './lib/snapping';
export { computeResizeSnap, computeSnap, resizeGuides } from './lib/snapping';

export {
  CONNECTOR_MAGNET,
  CONNECTOR_STANDOFF,
  DEF_FRAME_H,
  DEF_FRAME_W,
  DEF_H,
  DEF_PEN_COLOR,
  DEF_PEN_WIDTH,
  DEF_SETTINGS,
  DEF_VIEW,
  DEF_W,
  DRAW_COLORS,
  EDGE_CORNER_RADIUS,
  MAX_S,
  MIN_DRAW_PX,
  MIN_S,
  PEN_MAX_W,
  PEN_MIN_W,
  SNAP_PX,
} from './model/constants';

export {
  boundsOf,
  clamp,
  distToSegment,
  findConnectorMagnet,
  frameOf,
  nodesInFrame,
  nodesInRect,
  sidePoint,
  toC,
  toS,
  zoomTo,
} from './lib/geometry';

export type { SpaceRef } from './lib/spaceRef';
export { spaceRefNotation, spaceRefRe, stripSpaceRefs } from './lib/spaceRef';

export { edgeVerts, routeConnector } from './lib/routing';
export { roundedPath, smoothPath } from './lib/path';
export { drawNodePoints, mkDrawNode, mkNode } from './lib/factory';

export {
  DEFAULT_BOARD_ID,
  DEFAULT_BOARD_NAME,
  countBoards,
  defaultBoardMeta,
  deleteBoardData,
  loadBoard,
  loadBoardList,
  loadBoardSettings,
  loadBoardView,
  loadCurrentBoardId,
  saveBoard,
  saveBoardList,
  saveBoardSettings,
  saveBoardView,
  saveCurrentBoardId,
} from './api/storage';

import type { BoardSettings, T } from './types';

/** Default size of a node created by click (rather than drag). */
export const DEF_W = 160;
export const DEF_H = 80;

/** Default size of a frame created by click — big enough to drop a few blocks into. */
export const DEF_FRAME_W = 360;
export const DEF_FRAME_H = 240;

/** Below this drag distance a box/text drag counts as a plain click. */
export const MIN_DRAW_PX = 10;

/** Screen-px pull radius for smart-alignment snapping while dragging nodes. */
export const SNAP_PX = 6;

export const MIN_S = 0.08;
export const MAX_S = 4;

export const DEF_VIEW: T = { x: 0, y: 0, scale: 1 };
export const DEF_SETTINGS: BoardSettings = { edgePan: true, edgePanThreshold: 80, edgePanSpeed: 6 };

/** Distance a connector post sits off the node border — must match .bh-n/s/e/w offset in globals.css. */
export const CONNECTOR_STANDOFF = 30;
/** Snap radius when dropping an arrow onto another node's connector. */
export const CONNECTOR_MAGNET = 28;

/** How far a rerouted arrow swings around the blocks it would otherwise cut through. */
export const EDGE_DETOUR = 24;
export const EDGE_CORNER_RADIUS = 16;

/** Smallest bounding-box dimension for a freehand stroke, so a straight line stays grabbable. */
export const MIN_STROKE_DIM = 8;

export const PEN_MIN_W = 1;
export const PEN_MAX_W = 14;
export const DEF_PEN_COLOR = '#1c1c1e';
export const DEF_PEN_WIDTH = 3;

export const DRAW_COLORS = ['#1c1c1e', '#e0433d', '#2f6fed', '#1f9e5c', '#f0a020', '#8b5cf6'];

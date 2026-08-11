/**
 * Cross-import for the pack slice: a pack is a named grouping of sections, so `entities/pack`
 * genuinely needs the section type and the built-in section data. FSD routes such same-layer
 * dependencies through an explicit `@x` entry point instead of the slice's public API.
 */
export type { Section } from '../model/types';
export { defaultSections, defaultDoneIds } from '../model/defaultSections';

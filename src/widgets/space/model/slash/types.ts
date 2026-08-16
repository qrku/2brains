import type { IconName } from '@/shared/ui/Icon';

/* ─── Slash commands ──────────────────────────────────────────────────────── */
export interface Cmd {
  id: string;
  icon: string;
  svgIcon?: IconName; // when set, renders in place of the text glyph in `icon`
  label: string;
  group: string;
  snippet: string; // '|' = cursor position (MD mode)
  visual: string; // markdown to render in visual mode
  search?: string; // extra search aliases (English keywords etc.)
}

export interface SlashState {
  query: string;
  top: number;
  left: number;
  // MD mode
  mdStart?: number;
  // Visual mode
  node?: Node;
  nodeOffset?: number;
}

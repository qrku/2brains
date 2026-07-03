export type NoteColor = 'blue' | 'yellow' | 'green' | 'red' | 'gray';
export type BadgeColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' | 'pink' | 'gray';
export type ProgressColor = 'indigo' | 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange';

export interface HeadingBlock   { id: string; type: 'heading';   level: 1 | 2 | 3; text: string; }
export interface TextBlock      { id: string; type: 'text';      content: string; }
export interface DividerBlock   { id: string; type: 'divider'; }
export interface NoteBlock      { id: string; type: 'note';      content: string; color: NoteColor; }
export interface ProgressBlock  { id: string; type: 'progress';  label: string; value: number; color: ProgressColor; }
export interface StatItem       { id: string; value: string; label: string; sub?: string; }
export interface StatBlock      { id: string; type: 'stat';      items: StatItem[]; }
export interface CheckItem      { id: string; text: string; done: boolean; }
export interface ChecklistBlock { id: string; type: 'checklist'; title?: string; items: CheckItem[]; }
export interface TableBlock     { id: string; type: 'table';     cols: string[]; rows: string[][]; }
export interface KanbanCard     { id: string; text: string; }
export interface KanbanCol      { id: string; title: string; color: BadgeColor; cards: KanbanCard[]; }
export interface KanbanBlock    { id: string; type: 'kanban';    cols: KanbanCol[]; }
export interface BadgeItem      { id: string; text: string; color: BadgeColor; }
export interface BadgesBlock    { id: string; type: 'badges';    label?: string; items: BadgeItem[]; }
export interface LinkItem       { id: string; title: string; url: string; desc?: string; }
export interface LinkBlock      { id: string; type: 'link';      items: LinkItem[]; }
export interface RatingBlock    { id: string; type: 'rating';    label: string; value: number; max: number; }
export interface GalleryCard    { id: string; title: string; status: string; color: BadgeColor; }
export interface GalleryBlock   { id: string; type: 'gallery';   items: GalleryCard[]; }

export type Block =
  HeadingBlock | TextBlock | DividerBlock | NoteBlock |
  ProgressBlock | StatBlock | ChecklistBlock | TableBlock |
  KanbanBlock | BadgesBlock | LinkBlock | RatingBlock | GalleryBlock;

export type BlockType = Block['type'];

export interface CustomPage {
  id: string;
  title: string;
  icon: string;
  createdAt: number;
  blocks: Block[];
}

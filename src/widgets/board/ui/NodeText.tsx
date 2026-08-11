import { Icon } from '@/shared/ui/Icon';
import type { NoteRef } from './NoteAside';

/** Matches the [[space:<id>|<name>]] notation that useSlashMenu inserts. */
const REF_RE = /\[\[space:([^|]+)\|([^\]]+)\]\]/g;

interface Props {
  text: string;
  fontSize: number;
  onOpenNote: (note: NoteRef) => void;
}

/** A node's body: plain text, with Space references rendered as clickable chips. */
export function NodeText({ text, fontSize, onOpenNote }: Props) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, id, name] = m;
    parts.push(
      <span
        key={`${id}-${m.index}`}
        className="board-ref-chip"
        style={{ fontSize: Math.max(fontSize - 2, 10) }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenNote({ id, name });
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Icon name="file" size={11} /> {name}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return <>{parts}</>;
}

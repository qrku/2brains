import { spaceRefRe } from '@/entities/board';
import { Icon } from '@/shared/ui/Icon';
import type { NoteRef } from '../../NoteAside/NoteAside';
import styles from './NodeText.module.css';

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

  const refRe = spaceRefRe();
  while ((m = refRe.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, id, name] = m;
    parts.push(
      <span
        key={`${id}-${m.index}`}
        className={styles['board-ref-chip']}
        style={{ fontSize: Math.max(fontSize - 2, 10) }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenNote({ id, name });
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Icon name="file" size={11} /> {name}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return <>{parts}</>;
}

import { Brain } from './Brain';
import styles from './LandingScene.module.css';

/** Кусочек строки заметки: `k` задаёт подсветку, как в редакторе. */
type Tok = { t: string; k?: 'head' | 'link' | 'tag' | 'quote' | 'mark' };

type Note = {
  file: string;
  lines: Tok[][];
};

/* Карточки — витрина, а не данные: показывают, как выглядит хранилище заметок
   с ссылками, тегами и задачами. Порядок совпадает с классами .note-1…-6 в
   стилях, там же лежат координаты и наклон каждой — а концы линий ниже
   привязаны к краям карточек именно в этом порядке. */
const NOTES: Note[] = [
  {
    file: 'feature/space.md',
    lines: [
      [{ t: '# Пространство', k: 'head' }],
      [{ t: '[[очередь]]', k: 'link' }, { t: ' → воркер' }],
      [{ t: '- [ ] ', k: 'mark' }, { t: 'ретраи' }],
    ],
  },
  {
    file: 'feature/board.md',
    lines: [
      [{ t: '## Выписки', k: 'head' }],
      [{ t: '> память — это связи', k: 'quote' }],
      [{ t: '[[мышление]]', k: 'link' }],
    ],
  },
  {
    file: 'areas/дом.md',
    lines: [
      [{ t: '- ', k: 'mark' }, { t: 'ремонт' }],
      [{ t: '- ', k: 'mark' }, { t: 'документы' }],
    ],
  },
  {
    file: 'daily/2026-08-28.md',
    lines: [[{ t: 'созвон с Леной' }], [{ t: '#встречи', k: 'tag' }]],
  },
  {
    file: 'notes/идеи.md',
    lines: [
      [{ t: '- [x] ', k: 'mark' }, { t: 'прототип' }],
      [{ t: '[[доска]]', k: 'link' }, { t: ' → ' }, { t: '[[календарь]]', k: 'link' }],
    ],
  },
  {
    file: 'areas/учёба.md',
    lines: [
      [{ t: '## Алгоритмы', k: 'head' }],
      [{ t: '- ', k: 'mark' }, { t: 'графы' }],
      [{ t: '#повтор', k: 'tag' }],
    ],
  },
];

/* Линии от карточек к «мозгу». Координаты — в системе viewBox сцены, поэтому
   концы держатся своих карточек при любой ширине экрана: и SVG, и карточки
   размечены в одних и тех же долях одного и того же прямоугольника. */
const LINKS: { d: string; dashed?: boolean }[] = [
  { d: 'M 185,80 C 310,80 330,168 486,205' },
  { d: 'M 196,274 C 300,278 390,258 486,241' },
  { d: 'M 288,400 C 380,396 432,330 486,272' },
  { d: 'M 1011,64 C 900,82 800,142 714,201' },
  { d: 'M 1062,206 C 950,226 810,238 714,236', dashed: true },
  { d: 'M 1032,400 C 930,392 790,336 714,274', dashed: true },
];

function NoteCard({ note, index }: { note: Note; index: number }) {
  return (
    <div className={`${styles.note} ${styles[`note-${index + 1}`]}`}>
      <div className={styles['note-file']}>{note.file}</div>
      {note.lines.map((line, i) => (
        <div key={i} className={styles['note-line']}>
          {line.map((tok, j) => (
            <span key={j} className={tok.k ? styles[`tok-${tok.k}`] : undefined}>
              {tok.t}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function LandingScene() {
  return (
    <div className={styles.scene} aria-hidden>
      <svg className={styles.links} viewBox="0 0 1200 470" fill="none">
        {LINKS.map((l, i) => (
          <path
            key={i}
            d={l.d}
            className={`${styles.link} ${l.dashed ? styles['link-dashed'] : ''}`}
          />
        ))}
      </svg>

      <Brain />

      {NOTES.map((n, i) => (
        <NoteCard key={n.file} note={n} index={i} />
      ))}
    </div>
  );
}

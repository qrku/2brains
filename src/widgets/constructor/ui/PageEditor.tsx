'use client';

import { useState, useEffect, useRef } from 'react';
import { type CustomPage, type Block, type BlockType, type BadgeColor, type NoteColor, type ProgressColor, type StatItem, type CheckItem, type KanbanCard, type KanbanCol, type BadgeItem, type LinkItem, type GalleryCard, loadPage, savePage } from '@/entities/custom-page';
import { useWorkspaceStore } from '@/entities/workspace';
import { Icon, type IconName } from '@/shared/ui/Icon';

/* ─── Catalog ────────────────────────────────────────────────────────────── */
export const BLOCK_CATALOG: { type: BlockType; icon: string; svgIcon?: IconName; label: string; desc: string }[] = [
  { type: 'heading',   icon: 'H',  label: 'Заголовок',   desc: 'H1 / H2 / H3' },
  { type: 'text',      icon: '¶',  label: 'Текст',       desc: 'Абзац текста' },
  { type: 'divider',   icon: '—',  label: 'Разделитель', desc: 'Горизонтальная линия' },
  { type: 'note',      icon: '💬', label: 'Заметка',     desc: 'Цветной блок-выноска' },
  { type: 'progress',  icon: '▓',  label: 'Прогресс',    desc: 'Полоса с подписью и %' },
  { type: 'stat',      icon: '#',  label: 'Статистика',  desc: 'Большие числа-метрики' },
  { type: 'checklist', icon: '✓',  svgIcon: 'list-check', label: 'Чеклист',     desc: 'Список с чекбоксами' },
  { type: 'table',     icon: '⊞',  svgIcon: 'grid',       label: 'Таблица',     desc: 'Строки и столбцы' },
  { type: 'kanban',    icon: '⧉',  label: 'Канбан',      desc: 'Колонки с карточками' },
  { type: 'badges',    icon: '⬡',  label: 'Теги',        desc: 'Набор цветных меток' },
  { type: 'link',      icon: '⎋',  svgIcon: 'link-1',     label: 'Ссылки',      desc: 'Карточки со ссылками' },
  { type: 'rating',    icon: '★',  label: 'Рейтинг',     desc: 'Оценка звёздами' },
  { type: 'gallery',   icon: '▦',  label: 'Галерея',     desc: 'Сетка карточек' },
];

/* ─── Colour palettes ────────────────────────────────────────────────────── */
const NOTE_COLORS: { id: NoteColor; bg: string; border: string; text: string }[] = [
  { id: 'blue',   bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
  { id: 'yellow', bg: '#fefce8', border: '#fef08a', text: '#854d0e' },
  { id: 'green',  bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { id: 'red',    bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  { id: 'gray',   bg: '#f9fafb', border: '#e5e7eb', text: '#374151' },
];
const BADGE_COLORS: { id: BadgeColor; bg: string; text: string }[] = [
  { id: 'blue',   bg: '#dbeafe', text: '#1d4ed8' },
  { id: 'green',  bg: '#dcfce7', text: '#15803d' },
  { id: 'yellow', bg: '#fef9c3', text: '#a16207' },
  { id: 'red',    bg: '#fee2e2', text: '#b91c1c' },
  { id: 'purple', bg: '#f3e8ff', text: '#7e22ce' },
  { id: 'orange', bg: '#ffedd5', text: '#c2410c' },
  { id: 'pink',   bg: '#fce7f3', text: '#be185d' },
  { id: 'gray',   bg: '#f3f4f6', text: '#374151' },
];
const PROGRESS_COLORS: { id: ProgressColor; hex: string }[] = [
  { id: 'indigo', hex: '#6366f1' }, { id: 'blue',   hex: '#3b82f6' },
  { id: 'green',  hex: '#22c55e' }, { id: 'red',    hex: '#ef4444' },
  { id: 'yellow', hex: '#eab308' }, { id: 'purple', hex: '#a855f7' },
  { id: 'orange', hex: '#f97316' },
];

const badgeSt = (c: BadgeColor) => {
  const f = BADGE_COLORS.find((x) => x.id === c) ?? BADGE_COLORS[0];
  return { background: f.bg, color: f.text };
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);

function createBlock(type: BlockType): Block {
  const id = uid();
  switch (type) {
    case 'heading':   return { id, type, level: 2, text: 'Заголовок' };
    case 'text':      return { id, type, content: 'Введите текст...' };
    case 'divider':   return { id, type };
    case 'note':      return { id, type, content: 'Заметка', color: 'blue' };
    case 'progress':  return { id, type, label: 'Прогресс', value: 60, color: 'indigo' };
    case 'stat':      return { id, type, items: [{ id: uid(), value: '42', label: 'Метрика', sub: 'ед.' }] };
    case 'checklist': return { id, type, title: '', items: [{ id: uid(), text: 'Первый пункт', done: false }] };
    case 'table':     return { id, type, cols: ['Колонка 1', 'Колонка 2', 'Колонка 3'], rows: [['', '', '']] };
    case 'kanban':    return { id, type, cols: [
      { id: uid(), title: 'Сделать', color: 'gray',  cards: [{ id: uid(), text: 'Задача' }] },
      { id: uid(), title: 'В работе', color: 'blue', cards: [] },
      { id: uid(), title: 'Готово',  color: 'green', cards: [] },
    ]};
    case 'badges':    return { id, type, label: '', items: [{ id: uid(), text: 'Тег', color: 'blue' }] };
    case 'link':      return { id, type, items: [{ id: uid(), title: 'Ссылка', url: '', desc: '' }] };
    case 'rating':    return { id, type, label: 'Оценка', value: 3, max: 5 };
    case 'gallery':   return { id, type, items: [{ id: uid(), title: 'Карточка', status: 'Активно', color: 'blue' }] };
  }
}

/* ─── PageEditor ─────────────────────────────────────────────────────────── */
export function PageEditor({ pageId }: { pageId: string }) {
  const { state: wsState } = useWorkspaceStore();
  const [page,    setPage]    = useState<CustomPage | null>(null);
  const [editing, setEditing] = useState(false);
  const [picker,  setPicker]  = useState<number | null>(null); // insert after this index
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Правка, ожидающая записи: нужна, чтобы досохранить её при размонтировании. */
  const pendingRef = useRef<{ page: CustomPage; wsId: string } | null>(null);

  useEffect(() => {
    if (!wsState.hydrated) return;
    setPage(loadPage(pageId, wsState.currentId));
  }, [pageId, wsState.hydrated, wsState.currentId]);

  useEffect(() => {
    if (!page) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const pending = { page, wsId: wsState.currentId };
    pendingRef.current = pending;
    saveTimer.current = setTimeout(() => {
      savePage(pending.page, pending.wsId);
      pendingRef.current = null;
    }, 400);
    // Cleanup обязан снимать таймер независимо от guard'а выше: без него правка,
    // сделанная за 400 мс до смены воркспейса, записывалась под новый workspaceId.
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [page, wsState.currentId]);

  // Досохранение при уходе со страницы: cleanup выше только снимает таймер,
  // и без этого последние ≤400 мс правок терялись бы при размонтировании.
  useEffect(() => () => {
    const pending = pendingRef.current;
    if (pending) savePage(pending.page, pending.wsId);
  }, []);

  if (!page) return <div className="ctor-empty">Страница не найдена</div>;

  /* helpers */
  const setBlocks = (fn: (bs: Block[]) => Block[]) =>
    setPage((p) => p ? { ...p, blocks: fn(p.blocks) } : p);

  const updBlock = (id: string, fn: (b: Block) => Block) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? fn(b) : b)));

  const addBlock = (type: BlockType, afterIdx: number) => {
    const nb = createBlock(type);
    setBlocks((bs) => [...bs.slice(0, afterIdx + 1), nb, ...bs.slice(afterIdx + 1)]);
    setPicker(null);
  };

  const removeBlock  = (id: string)  => setBlocks((bs) => bs.filter((b) => b.id !== id));
  const moveBlock    = (id: string, dir: -1 | 1) => setBlocks((bs) => {
    const i = bs.findIndex((b) => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= bs.length) return bs;
    const next = [...bs]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });

  /* ── Render each block ── */
  const renderBlock = (block: Block) => {
    const upd = (patch: Partial<Block>) => updBlock(block.id, (b) => ({ ...b, ...patch } as Block));

    switch (block.type) {
      /* ── Heading ── */
      case 'heading': return (
        <div className="ctor-heading-wrap">
          {editing && (
            <div className="ctor-heading-levels">
              {([1,2,3] as const).map((l) => (
                <button key={l} className={`ctor-hlvl${block.level === l ? ' active' : ''}`}
                  onClick={() => upd({ level: l })}>H{l}</button>
              ))}
            </div>
          )}
          {editing
            ? <input className={`ctor-heading-input h${block.level}`} value={block.text}
                onChange={(e) => upd({ text: e.target.value })} />
            : <div className={`ctor-heading h${block.level}`}>{block.text}</div>
          }
        </div>
      );

      /* ── Text ── */
      case 'text': return editing
        ? <textarea className="ctor-text-area" value={block.content} rows={3}
            onChange={(e) => upd({ content: e.target.value })} />
        : <p className="ctor-text">{block.content}</p>;

      /* ── Divider ── */
      case 'divider': return <hr className="ctor-divider" />;

      /* ── Note ── */
      case 'note': {
        const nc = NOTE_COLORS.find((c) => c.id === block.color) ?? NOTE_COLORS[0];
        return (
          <div className="ctor-note" style={{ background: nc.bg, borderColor: nc.border, color: nc.text }}>
            {editing && (
              <div className="ctor-note-colors">
                {NOTE_COLORS.map((c) => (
                  <button key={c.id} className={`ctor-color-dot${block.color === c.id ? ' active' : ''}`}
                    style={{ background: c.bg, borderColor: c.border }}
                    onClick={() => upd({ color: c.id })} />
                ))}
              </div>
            )}
            {editing
              ? <textarea className="ctor-note-area" value={block.content} rows={2}
                  style={{ color: nc.text }} onChange={(e) => upd({ content: e.target.value })} />
              : <span>{block.content}</span>
            }
          </div>
        );
      }

      /* ── Progress ── */
      case 'progress': {
        const col = PROGRESS_COLORS.find((c) => c.id === block.color)?.hex ?? '#6366f1';
        return (
          <div className="ctor-progress-wrap">
            {editing
              ? <input className="ctor-inline-input" value={block.label}
                  onChange={(e) => upd({ label: e.target.value })} placeholder="Подпись" />
              : <div className="ctor-progress-label">{block.label}</div>
            }
            <div className="ctor-progress-row">
              <div className="ctor-progress-bar">
                <div className="ctor-progress-fill" style={{ width: `${block.value}%`, background: col }} />
              </div>
              <span className="ctor-progress-pct">{block.value}%</span>
            </div>
            {editing && (
              <div className="ctor-progress-controls">
                <input type="range" min={0} max={100} value={block.value}
                  onChange={(e) => upd({ value: +e.target.value })} className="ctor-slider" />
                <div className="ctor-color-row">
                  {PROGRESS_COLORS.map((c) => (
                    <button key={c.id} className={`ctor-color-dot${block.color === c.id ? ' active' : ''}`}
                      style={{ background: c.hex, borderColor: c.hex }}
                      onClick={() => upd({ color: c.id })} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      /* ── Stat ── */
      case 'stat': {
        const items: StatItem[] = block.items;
        const updItems = (fn: (is: StatItem[]) => StatItem[]) => upd({ items: fn(items) } as Partial<Block>);
        return (
          <div className="ctor-stat-grid">
            {items.map((it) => (
              <div key={it.id} className="ctor-stat-card">
                {editing ? (
                  <>
                    <input className="ctor-stat-val-input" value={it.value} placeholder="42"
                      onChange={(e) => updItems((is) => is.map((x) => x.id === it.id ? { ...x, value: e.target.value } : x))} />
                    <input className="ctor-stat-lbl-input" value={it.label} placeholder="Метрика"
                      onChange={(e) => updItems((is) => is.map((x) => x.id === it.id ? { ...x, label: e.target.value } : x))} />
                    <input className="ctor-stat-sub-input" value={it.sub ?? ''} placeholder="Подпись"
                      onChange={(e) => updItems((is) => is.map((x) => x.id === it.id ? { ...x, sub: e.target.value } : x))} />
                    <button className="ctor-mini-del" onClick={() => updItems((is) => is.filter((x) => x.id !== it.id))}><Icon name="close" size={11} /></button>
                  </>
                ) : (
                  <>
                    <div className="ctor-stat-value">{it.value}</div>
                    <div className="ctor-stat-label">{it.label}</div>
                    {it.sub && <div className="ctor-stat-sub">{it.sub}</div>}
                  </>
                )}
              </div>
            ))}
            {editing && (
              <button className="ctor-stat-add" onClick={() => updItems((is) => [...is, { id: uid(), value: '0', label: 'Метрика' }])}>
                <Icon name="add" size={13} />
              </button>
            )}
          </div>
        );
      }

      /* ── Checklist ── */
      case 'checklist': {
        const items: CheckItem[] = block.items;
        const updItems = (fn: (is: CheckItem[]) => CheckItem[]) => upd({ items: fn(items) } as Partial<Block>);
        const done = items.filter((i) => i.done).length;
        return (
          <div className="ctor-checklist">
            {(block.title || editing) && (
              editing
                ? <input className="ctor-inline-input ctor-checklist-title" value={block.title ?? ''} placeholder="Название списка"
                    onChange={(e) => upd({ title: e.target.value } as Partial<Block>)} />
                : <div className="ctor-checklist-title">{block.title}</div>
            )}
            <div className="ctor-checklist-progress">
              <div className="ctor-progress-bar sm">
                <div className="ctor-progress-fill" style={{ width: items.length ? `${(done/items.length)*100}%` : '0%', background: '#22c55e' }} />
              </div>
              <span className="ctor-progress-pct">{done}/{items.length}</span>
            </div>
            {items.map((it) => (
              <div key={it.id} className="ctor-check-item">
                <input type="checkbox" checked={it.done} className="ctor-checkbox"
                  onChange={() => updItems((is) => is.map((x) => x.id === it.id ? { ...x, done: !x.done } : x))} />
                {editing
                  ? <input className="ctor-check-input" value={it.text}
                      onChange={(e) => updItems((is) => is.map((x) => x.id === it.id ? { ...x, text: e.target.value } : x))} />
                  : <span className={`ctor-check-text${it.done ? ' done' : ''}`}>{it.text}</span>
                }
                {editing && <button className="ctor-mini-del" onClick={() => updItems((is) => is.filter((x) => x.id !== it.id))}><Icon name="close" size={11} /></button>}
              </div>
            ))}
            {editing && (
              <button className="ctor-add-row"
                onClick={() => updItems((is) => [...is, { id: uid(), text: '', done: false }])}>
                <Icon name="add" size={11} /> Добавить пункт
              </button>
            )}
          </div>
        );
      }

      /* ── Table ── */
      case 'table': {
        const { cols, rows } = block;
        const updTable = (patch: { cols?: string[]; rows?: string[][] }) =>
          upd({ ...patch } as Partial<Block>);
        return (
          <div className="ctor-table-wrap">
            <table className="ctor-table">
              <thead>
                <tr>
                  {cols.map((c, ci) => (
                    <th key={ci}>
                      {editing
                        ? <input className="ctor-table-cell-input" value={c}
                            onChange={(e) => { const nc = [...cols]; nc[ci] = e.target.value; updTable({ cols: nc }); }} />
                        : c
                      }
                    </th>
                  ))}
                  {editing && <th><button className="ctor-mini-del" onClick={() => {
                    updTable({ cols: [...cols, 'Колонка'], rows: rows.map((r) => [...r, '']) });
                  }}><Icon name="add" size={11} /></button></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>
                        {editing
                          ? <input className="ctor-table-cell-input" value={cell}
                              onChange={(e) => {
                                const nr = rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? e.target.value : c) : r);
                                updTable({ rows: nr });
                              }} />
                          : cell
                        }
                      </td>
                    ))}
                    {editing && <td><button className="ctor-mini-del" onClick={() => updTable({ rows: rows.filter((_, i) => i !== ri) })}><Icon name="close" size={11} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editing && (
              <button className="ctor-add-row" onClick={() => updTable({ rows: [...rows, cols.map(() => '')] })}>
                <Icon name="add" size={11} /> Добавить строку
              </button>
            )}
          </div>
        );
      }

      /* ── Kanban ── */
      case 'kanban': {
        const { cols } = block;
        const updCols = (fn: (cs: KanbanCol[]) => KanbanCol[]) => upd({ cols: fn(cols) } as Partial<Block>);
        return (
          <div className="ctor-kanban">
            {cols.map((col) => {
              const st = BADGE_COLORS.find((c) => c.id === col.color) ?? BADGE_COLORS[7];
              return (
                <div key={col.id} className="ctor-kanban-col">
                  <div className="ctor-kanban-header" style={{ background: st.bg, color: st.text }}>
                    {editing
                      ? <input className="ctor-kanban-col-input" value={col.title} style={{ color: st.text }}
                          onChange={(e) => updCols((cs) => cs.map((c) => c.id === col.id ? { ...c, title: e.target.value } : c))} />
                      : col.title
                    }
                    {editing && (
                      <div className="ctor-kanban-col-colors">
                        {BADGE_COLORS.slice(0,6).map((bc) => (
                          <button key={bc.id} className="ctor-color-dot sm"
                            style={{ background: bc.bg, borderColor: bc.text, opacity: col.color === bc.id ? 1 : 0.4 }}
                            onClick={() => updCols((cs) => cs.map((c) => c.id === col.id ? { ...c, color: bc.id } : c))} />
                        ))}
                        <button className="ctor-mini-del ml"
                          onClick={() => updCols((cs) => cs.filter((c) => c.id !== col.id))}><Icon name="close" size={11} /></button>
                      </div>
                    )}
                  </div>
                  <div className="ctor-kanban-cards">
                    {col.cards.map((card) => (
                      <div key={card.id} className="ctor-kanban-card">
                        {editing
                          ? <input className="ctor-kanban-card-input" value={card.text}
                              onChange={(e) => updCols((cs) => cs.map((c) => c.id === col.id
                                ? { ...c, cards: c.cards.map((k) => k.id === card.id ? { ...k, text: e.target.value } : k) }
                                : c))}
                            />
                          : card.text
                        }
                        {editing && (
                          <button className="ctor-mini-del"
                            onClick={() => updCols((cs) => cs.map((c) => c.id === col.id
                              ? { ...c, cards: c.cards.filter((k) => k.id !== card.id) } : c))}><Icon name="close" size={11} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  {editing && (
                    <button className="ctor-add-row"
                      onClick={() => updCols((cs) => cs.map((c) => c.id === col.id
                        ? { ...c, cards: [...c.cards, { id: uid(), text: 'Карточка' }] } : c))}>
                      <Icon name="add" size={11} /> Карточка
                    </button>
                  )}
                </div>
              );
            })}
            {editing && (
              <button className="ctor-kanban-add-col"
                onClick={() => updCols((cs) => [...cs, { id: uid(), title: 'Колонка', color: 'gray', cards: [] }])}>
                <Icon name="add" size={14} />
              </button>
            )}
          </div>
        );
      }

      /* ── Badges ── */
      case 'badges': {
        const items: BadgeItem[] = block.items;
        const updItems = (fn: (is: BadgeItem[]) => BadgeItem[]) => upd({ items: fn(items) } as Partial<Block>);
        return (
          <div className="ctor-badges-wrap">
            {(block.label || editing) && (
              editing
                ? <input className="ctor-inline-input" value={block.label ?? ''} placeholder="Заголовок группы"
                    onChange={(e) => upd({ label: e.target.value } as Partial<Block>)} />
                : <div className="ctor-badges-label">{block.label}</div>
            )}
            <div className="ctor-badges">
              {items.map((it) => (
                <span key={it.id} className="ctor-badge" style={badgeSt(it.color)}>
                  {editing
                    ? <input className="ctor-badge-input" value={it.text} style={{ color: badgeSt(it.color).color }}
                        onChange={(e) => updItems((is) => is.map((x) => x.id === it.id ? { ...x, text: e.target.value } : x))} />
                    : it.text
                  }
                  {editing && (
                    <span className="ctor-badge-colors">
                      {BADGE_COLORS.map((bc) => (
                        <button key={bc.id} className="ctor-color-dot xs"
                          style={{ background: bc.bg, borderColor: bc.text, outline: it.color === bc.id ? `2px solid ${bc.text}` : 'none' }}
                          onClick={() => updItems((is) => is.map((x) => x.id === it.id ? { ...x, color: bc.id } : x))} />
                      ))}
                      <button className="ctor-mini-del" onClick={() => updItems((is) => is.filter((x) => x.id !== it.id))}><Icon name="close" size={11} /></button>
                    </span>
                  )}
                </span>
              ))}
              {editing && (
                <button className="ctor-badge ctor-badge-add" onClick={() => updItems((is) => [...is, { id: uid(), text: 'Тег', color: 'blue' }])}>
                  <Icon name="add" size={10} /> Добавить
                </button>
              )}
            </div>
          </div>
        );
      }

      /* ── Links ── */
      case 'link': {
        const items: LinkItem[] = block.items;
        const updItems = (fn: (is: LinkItem[]) => LinkItem[]) => upd({ items: fn(items) } as Partial<Block>);
        return (
          <div className="ctor-links">
            {items.map((it) => (
              <div key={it.id} className="ctor-link-card">
                {editing ? (
                  <div className="ctor-link-form">
                    <input className="ctor-inline-input" value={it.title} placeholder="Название"
                      onChange={(e) => updItems((is) => is.map((x) => x.id === it.id ? { ...x, title: e.target.value } : x))} />
                    <input className="ctor-inline-input" value={it.url} placeholder="URL (https://...)"
                      onChange={(e) => updItems((is) => is.map((x) => x.id === it.id ? { ...x, url: e.target.value } : x))} />
                    <input className="ctor-inline-input" value={it.desc ?? ''} placeholder="Описание (необязательно)"
                      onChange={(e) => updItems((is) => is.map((x) => x.id === it.id ? { ...x, desc: e.target.value } : x))} />
                    <button className="ctor-mini-del" onClick={() => updItems((is) => is.filter((x) => x.id !== it.id))}><Icon name="close" size={11} /></button>
                  </div>
                ) : (
                  <a href={it.url || '#'} target="_blank" rel="noopener noreferrer" className="ctor-link-a">
                    <div className="ctor-link-title">{it.title}</div>
                    {it.desc && <div className="ctor-link-desc">{it.desc}</div>}
                    <div className="ctor-link-url">{it.url}</div>
                  </a>
                )}
              </div>
            ))}
            {editing && (
              <button className="ctor-add-row"
                onClick={() => updItems((is) => [...is, { id: uid(), title: 'Ссылка', url: '', desc: '' }])}>
                <Icon name="add" size={11} /> Добавить ссылку
              </button>
            )}
          </div>
        );
      }

      /* ── Rating ── */
      case 'rating': {
        const stars = Array.from({ length: block.max }, (_, i) => i + 1);
        return (
          <div className="ctor-rating-wrap">
            {editing
              ? <input className="ctor-inline-input" value={block.label}
                  onChange={(e) => upd({ label: e.target.value } as Partial<Block>)} placeholder="Подпись" />
              : <div className="ctor-rating-label">{block.label}</div>
            }
            <div className="ctor-stars">
              {stars.map((i) => (
                <button key={i} className={`ctor-star${i <= block.value ? ' filled' : ''}`}
                  onClick={() => upd({ value: i } as Partial<Block>)}>★</button>
              ))}
            </div>
            {editing && (
              <div className="ctor-rating-max">
                Макс:&nbsp;
                {[5,7,10].map((m) => (
                  <button key={m} className={`ctor-hlvl${block.max === m ? ' active' : ''}`}
                    onClick={() => upd({ max: m, value: Math.min(block.value, m) } as Partial<Block>)}>{m}</button>
                ))}
              </div>
            )}
          </div>
        );
      }

      /* ── Gallery ── */
      case 'gallery': {
        const items: GalleryCard[] = block.items;
        const updItems = (fn: (is: GalleryCard[]) => GalleryCard[]) => upd({ items: fn(items) } as Partial<Block>);
        return (
          <div className="ctor-gallery">
            {items.map((it) => (
              <div key={it.id} className="ctor-gallery-card">
                <div className="ctor-gallery-badge" style={badgeSt(it.color)}>
                  {editing
                    ? <input className="ctor-badge-input" value={it.status} style={{ color: badgeSt(it.color).color }}
                        onChange={(e) => updItems((is) => is.map((x) => x.id === it.id ? { ...x, status: e.target.value } : x))} />
                    : it.status
                  }
                </div>
                {editing
                  ? <input className="ctor-gallery-title-input" value={it.title}
                      onChange={(e) => updItems((is) => is.map((x) => x.id === it.id ? { ...x, title: e.target.value } : x))} />
                  : <div className="ctor-gallery-title">{it.title}</div>
                }
                {editing && (
                  <div className="ctor-gallery-colors">
                    {BADGE_COLORS.map((bc) => (
                      <button key={bc.id} className="ctor-color-dot xs"
                        style={{ background: bc.bg, borderColor: bc.text, outline: it.color === bc.id ? `2px solid ${bc.text}` : 'none' }}
                        onClick={() => updItems((is) => is.map((x) => x.id === it.id ? { ...x, color: bc.id } : x))} />
                    ))}
                    <button className="ctor-mini-del" onClick={() => updItems((is) => is.filter((x) => x.id !== it.id))}><Icon name="close" size={11} /></button>
                  </div>
                )}
              </div>
            ))}
            {editing && (
              <button className="ctor-gallery-add"
                onClick={() => updItems((is) => [...is, { id: uid(), title: 'Карточка', status: 'Новое', color: 'blue' }])}>
                <Icon name="add" size={16} />
              </button>
            )}
          </div>
        );
      }
    }
  };

  /* ── Block wrapper with toolbar ── */
  const wrapBlock = (block: Block, idx: number) => (
    <div key={block.id} className={`ctor-block${editing ? ' editable' : ''}`}>
      {editing && (
        <div className="ctor-block-toolbar">
          <button className="ctor-tb-btn" onClick={() => moveBlock(block.id, -1)} title="Вверх"><Icon name="arrow-up" size={12} /></button>
          <button className="ctor-tb-btn" onClick={() => moveBlock(block.id,  1)} title="Вниз"><Icon name="arrow-down" size={12} /></button>
          <span className="ctor-tb-type">{BLOCK_CATALOG.find((c) => c.type === block.type)?.label}</span>
          <button className="ctor-tb-del" onClick={() => removeBlock(block.id)} title="Удалить"><Icon name="close" size={13} /></button>
        </div>
      )}
      {renderBlock(block)}
      {editing && (
        <button className="ctor-add-between" onClick={() => setPicker(idx)} title="Добавить блок"><Icon name="add" size={13} /></button>
      )}
    </div>
  );

  return (
    <div className="ctor-page">
      {/* Header */}
      <div className="ctor-page-header">
        <div className="ctor-page-title-row">
          <span className="ctor-page-icon">{page.icon}</span>
          <input
            className="ctor-page-title"
            value={page.title}
            onChange={(e) => setPage((p) => p ? { ...p, title: e.target.value } : p)}
          />
        </div>
        <button
          className={`ctor-edit-btn${editing ? ' active' : ''}`}
          onClick={() => { setEditing((v) => !v); setPicker(null); }}
        >
          {editing ? 'Готово' : 'Редактировать'}
        </button>
      </div>

      {/* Blocks */}
      <div className="ctor-blocks">
        {editing && page.blocks.length === 0 && (
          <button className="ctor-add-first" onClick={() => setPicker(-1)}>
            <Icon name="add" size={13} /> Добавить первый блок
          </button>
        )}
        {editing && page.blocks.length > 0 && (
          <button className="ctor-add-between top" onClick={() => setPicker(-1)}><Icon name="add" size={13} /></button>
        )}
        {page.blocks.map((b, i) => wrapBlock(b, i))}
      </div>

      {/* Block picker */}
      {picker !== null && (
        <div className="ctor-picker-overlay" onClick={() => setPicker(null)}>
          <div className="ctor-picker" onClick={(e) => e.stopPropagation()}>
            <div className="ctor-picker-title">Выберите блок</div>
            <div className="ctor-picker-grid">
              {BLOCK_CATALOG.map((cat) => (
                <button key={cat.type} className="ctor-picker-card" onClick={() => addBlock(cat.type, picker)}>
                  <span className="ctor-picker-icon">{cat.svgIcon ? <Icon name={cat.svgIcon} size={16} /> : cat.icon}</span>
                  <span className="ctor-picker-label">{cat.label}</span>
                  <span className="ctor-picker-desc">{cat.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

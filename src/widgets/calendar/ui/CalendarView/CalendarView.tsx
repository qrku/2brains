'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { uid } from '@/shared/lib/uid';
import { useWorkspaceStore } from '@/entities/workspace';
import { wsKey } from '@/shared/lib/workspace';
import { Icon } from '@/shared/ui/Icon';
import { cx } from '@/shared/lib/cx';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import styles from './CalendarView.module.css';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface CalEvent {
  id: string;
  date: string; // 'YYYY-MM-DD'
  title: string;
  time?: string; // 'HH:MM'
  color: string;
  note?: string;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'calendar_events_v1';
const EVENT_COLORS = ['#2f6fed', '#e0433d', '#1f9e5c', '#f0a020', '#8b5cf6', '#6b7280'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];
const MAX_VISIBLE_EVENTS = 3;
/** Столько точек помещается в ячейку узкой сетки; остальные сворачиваются в «+N». */
const MAX_VISIBLE_DOTS = 4;

/* ─── Date helpers ──────────────────────────────────────────────────────── */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
function addDays(d: Date, delta: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + delta);
  return nd;
}
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
} // 0 = Monday

/** Fixed 6-week (42-cell) grid so the layout height stays stable across months. */
function buildMonthGrid(monthStart: Date): Date[] {
  const gridStart = addDays(monthStart, -mondayIndex(monthStart));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/* ─── Persistence ───────────────────────────────────────────────────────── */
function loadEvents(workspaceId: string): CalEvent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(wsKey(STORAGE_KEY, workspaceId)) ?? 'null');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function saveEvents(events: CalEvent[], workspaceId: string) {
  try {
    localStorage.setItem(wsKey(STORAGE_KEY, workspaceId), JSON.stringify(events));
  } catch {}
}

/* ─── CalendarView ──────────────────────────────────────────────────────── */
export function CalendarView() {
  const { state: wsState } = useWorkspaceStore();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [modal, setModal] = useState<{ date: Date; event: CalEvent | null } | null>(null);

  /**
   * На узкой сетке в ячейку не помещается ни название события, ни время: при семи
   * колонках на 360 px клетка выходит около 45 px шириной. Поэтому там события
   * показываются точками, а нажатие на день открывает его список, откуда уже
   * можно открыть событие или добавить новое. На широком экране всё как было:
   * события читаются прямо в сетке, а нажатие сразу создаёт новое.
   */
  const narrow = useMediaQuery('(max-width: 720px)');
  const [daySheet, setDaySheet] = useState<Date | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The workspace whose data is currently loaded into `events` — debounced saves
  // flush to this so a mid-debounce workspace switch can't cross-contaminate storage.
  const eventsWsId = useRef(wsState.currentId);

  useEffect(() => {
    if (!wsState.hydrated) return;
    setEvents(loadEvents(wsState.currentId));
    eventsWsId.current = wsState.currentId;
    setReady(true);
  }, [wsState.hydrated, wsState.currentId]);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveEvents(events, eventsWsId.current), 300);
  }, [events, ready]);

  const today = useMemo(() => new Date(), []);
  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date);
      if (list) list.push(ev);
      else map.set(ev.date, [ev]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return -1;
        if (!b.time) return 1;
        return a.time.localeCompare(b.time);
      });
    }
    return map;
  }, [events]);

  const openCreate = (date: Date) => {
    setDaySheet(null);
    setModal({ date, event: null });
  };
  const openEdit = (date: Date, ev: CalEvent) => {
    setDaySheet(null);
    setModal({ date, event: ev });
  };
  const closeModal = () => setModal(null);

  // Пустой день на узком экране незачем показывать списком — сразу создаём.
  const onCellClick = (day: Date, count: number) => {
    if (narrow && count > 0) setDaySheet(day);
    else openCreate(day);
  };

  const saveEvent = (data: {
    id?: string;
    date: string;
    title: string;
    time?: string;
    color: string;
    note?: string;
  }) => {
    setEvents((es) =>
      data.id
        ? es.map((e) => (e.id === data.id ? { ...e, ...data, id: data.id! } : e))
        : [...es, { ...data, id: uid() }],
    );
    closeModal();
  };
  const deleteEvent = (id: string) => {
    setEvents((es) => es.filter((e) => e.id !== id));
    closeModal();
  };

  return (
    <div className={styles['cal-wrap']}>
      <div className={styles['cal-header']}>
        <div className={styles['cal-title']}>
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </div>
        <div className={styles['cal-nav']}>
          <button
            className={styles['cal-nav-btn']}
            onClick={() => setCursor((c) => addMonths(c, -1))}
            title="Предыдущий месяц"
          >
            <Icon name="arrow-back-simple" size={13} />
          </button>
          <button
            className={styles['cal-today-btn']}
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Сегодня
          </button>
          <button
            className={styles['cal-nav-btn']}
            onClick={() => setCursor((c) => addMonths(c, 1))}
            title="Следующий месяц"
          >
            <Icon name="arrow-forward-simple" size={13} />
          </button>
        </div>
      </div>

      <div className={styles['cal-weekdays']}>
        {WEEKDAYS.map((w) => (
          <div key={w} className={styles['cal-weekday']}>
            {w}
          </div>
        ))}
      </div>

      <div className={styles['cal-grid']}>
        {grid.map((day) => {
          const key = dateKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = isSameDay(day, today);
          return (
            <div
              key={key}
              className={cx(
                styles['cal-cell'],
                !inMonth && styles['cal-cell-out'],
                isToday && styles['cal-cell-today'],
              )}
              onClick={() => onCellClick(day, dayEvents.length)}
            >
              <div className={styles['cal-cell-head']}>
                <span className={styles['cal-cell-num']}>{day.getDate()}</span>
                <button
                  className={styles['cal-cell-add']}
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreate(day);
                  }}
                  title="Добавить событие"
                >
                  <Icon name="add" size={11} />
                </button>
              </div>

              {narrow ? (
                <div className={styles['cal-cell-dots']}>
                  {dayEvents.slice(0, MAX_VISIBLE_DOTS).map((ev) => (
                    <span
                      key={ev.id}
                      className={styles['cal-dot']}
                      style={{ background: ev.color }}
                    />
                  ))}
                  {dayEvents.length > MAX_VISIBLE_DOTS && (
                    <span className={styles['cal-dot-more']}>
                      +{dayEvents.length - MAX_VISIBLE_DOTS}
                    </span>
                  )}
                </div>
              ) : (
                <div className={styles['cal-cell-events']}>
                  {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((ev) => (
                    <div
                      key={ev.id}
                      className={styles['cal-event']}
                      style={{ background: `${ev.color}1f`, borderLeftColor: ev.color }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(day, ev);
                      }}
                    >
                      {ev.time && <span className={styles['cal-event-time']}>{ev.time}</span>}
                      <span className={styles['cal-event-title']}>{ev.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > MAX_VISIBLE_EVENTS && (
                    <div className={styles['cal-event-more']}>
                      +{dayEvents.length - MAX_VISIBLE_EVENTS} ещё
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {daySheet && (
        <DaySheet
          date={daySheet}
          events={eventsByDay.get(dateKey(daySheet)) ?? []}
          onPick={(ev) => openEdit(daySheet, ev)}
          onAdd={() => openCreate(daySheet)}
          onClose={() => setDaySheet(null)}
        />
      )}

      {modal && (
        <EventModal
          date={modal.date}
          event={modal.event}
          onSave={saveEvent}
          onDelete={modal.event ? () => deleteEvent(modal.event!.id) : undefined}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

/* ─── DaySheet ───────────────────────────────────────────────────────────── */

interface DaySheetProps {
  date: Date;
  events: CalEvent[];
  onPick: (ev: CalEvent) => void;
  onAdd: () => void;
  onClose: () => void;
}

/** События одного дня — то, что на узкой сетке помещается в ячейку только точками. */
function DaySheet({ date, events, onPick, onAdd, onClose }: DaySheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={styles['cal-modal-overlay']}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cx(styles['cal-modal'], styles['cal-day-sheet'])}>
        <div className={styles['cal-modal-header']}>
          <span className={styles['cal-modal-date']}>
            {date.getDate()} {MONTHS[date.getMonth()]} {date.getFullYear()}
          </span>
          <button className={styles['cal-modal-close']} onClick={onClose}>
            <Icon name="close" size={13} />
          </button>
        </div>

        <div className={styles['cal-day-list']}>
          {events.map((ev) => (
            <button
              key={ev.id}
              className={styles['cal-day-item']}
              style={{ borderLeftColor: ev.color }}
              onClick={() => onPick(ev)}
            >
              <span className={styles['cal-day-item-time']}>{ev.time || '—'}</span>
              <span className={styles['cal-day-item-title']}>{ev.title}</span>
            </button>
          ))}
        </div>

        <button className={cx(styles['cal-btn'], styles['cal-btn-primary'])} onClick={onAdd}>
          Добавить событие
        </button>
      </div>
    </div>
  );
}

/* ─── EventModal ─────────────────────────────────────────────────────────── */
interface EventModalProps {
  date: Date;
  event: CalEvent | null;
  onSave: (data: {
    id?: string;
    date: string;
    title: string;
    time?: string;
    color: string;
    note?: string;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function EventModal({ date, event, onSave, onDelete, onClose }: EventModalProps) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [time, setTime] = useState(event?.time ?? '');
  const [color, setColor] = useState(event?.color ?? EVENT_COLORS[0]);
  const [note, setNote] = useState(event?.note ?? '');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: event?.id,
      date: dateKey(date),
      title: title.trim(),
      time: time || undefined,
      color,
      note: note.trim() || undefined,
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  };

  return (
    <div
      className={styles['cal-modal-overlay']}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles['cal-modal']} onKeyDown={onKeyDown}>
        <div className={styles['cal-modal-header']}>
          <span className={styles['cal-modal-date']}>
            {date.getDate()} {MONTHS[date.getMonth()]} {date.getFullYear()}
          </span>
          <button className={styles['cal-modal-close']} onClick={onClose}>
            <Icon name="close" size={13} />
          </button>
        </div>

        <input
          ref={titleRef}
          className={cx(styles['cal-input'], styles['cal-input-title'])}
          placeholder="Название события"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className={styles['cal-modal-row']}>
          <input
            type="time"
            className={styles['cal-input']}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <div className={styles['cal-colors']}>
            {EVENT_COLORS.map((c) => (
              <button
                key={c}
                className={cx(styles['cal-color-swatch'], color === c && styles.active)}
                style={{ background: c }}
                title={c}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <textarea
          className={cx(styles['cal-input'], styles['cal-textarea'])}
          placeholder="Описание (необязательно)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />

        <div className={styles['cal-modal-actions']}>
          {onDelete && (
            <button className={cx(styles['cal-btn'], styles['cal-btn-del'])} onClick={onDelete}>
              Удалить
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className={styles['cal-btn']} onClick={onClose}>
            Отмена
          </button>
          <button
            className={cx(styles['cal-btn'], styles['cal-btn-primary'])}
            onClick={handleSave}
            disabled={!title.trim()}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { uid } from '@/shared/lib/uid';
import { Icon } from '@/shared/ui/Icon';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface CalEvent {
  id: string;
  date: string;   // 'YYYY-MM-DD'
  title: string;
  time?: string;  // 'HH:MM'
  color: string;
  note?: string;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'calendar_events_v1';
const EVENT_COLORS = ['#2f6fed', '#e0433d', '#1f9e5c', '#f0a020', '#8b5cf6', '#6b7280'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MAX_VISIBLE_EVENTS = 3;

/* ─── Date helpers ──────────────────────────────────────────────────────── */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function isSameDay(a: Date, b: Date): boolean { return dateKey(a) === dateKey(b); }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, delta: number): Date { return new Date(d.getFullYear(), d.getMonth() + delta, 1); }
function addDays(d: Date, delta: number): Date { const nd = new Date(d); nd.setDate(nd.getDate() + delta); return nd; }
function mondayIndex(d: Date): number { return (d.getDay() + 6) % 7; } // 0 = Monday

/** Fixed 6-week (42-cell) grid so the layout height stays stable across months. */
function buildMonthGrid(monthStart: Date): Date[] {
  const gridStart = addDays(monthStart, -mondayIndex(monthStart));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/* ─── Persistence ───────────────────────────────────────────────────────── */
function loadEvents(): CalEvent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}
function saveEvents(events: CalEvent[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch {}
}

/* ─── CalendarView ──────────────────────────────────────────────────────── */
export function CalendarView() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [ready,  setReady]  = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [modal,  setModal]  = useState<{ date: Date; event: CalEvent | null } | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setEvents(loadEvents());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveEvents(events), 300);
  }, [events, ready]);

  const today = useMemo(() => new Date(), []);
  const grid  = useMemo(() => buildMonthGrid(cursor), [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date);
      if (list) list.push(ev); else map.set(ev.date, [ev]);
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

  const openCreate = (date: Date) => setModal({ date, event: null });
  const openEdit   = (date: Date, ev: CalEvent) => setModal({ date, event: ev });
  const closeModal = () => setModal(null);

  const saveEvent = (data: { id?: string; date: string; title: string; time?: string; color: string; note?: string }) => {
    setEvents((es) => data.id
      ? es.map((e) => e.id === data.id ? { ...e, ...data, id: data.id! } : e)
      : [...es, { ...data, id: uid() }]);
    closeModal();
  };
  const deleteEvent = (id: string) => {
    setEvents((es) => es.filter((e) => e.id !== id));
    closeModal();
  };

  return (
    <div className="cal-wrap">
      <div className="cal-header">
        <div className="cal-title">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</div>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => setCursor((c) => addMonths(c, -1))} title="Предыдущий месяц"><Icon name="arrow-back-simple" size={13} /></button>
          <button className="cal-today-btn" onClick={() => setCursor(startOfMonth(new Date()))}>Сегодня</button>
          <button className="cal-nav-btn" onClick={() => setCursor((c) => addMonths(c, 1))} title="Следующий месяц"><Icon name="arrow-forward-simple" size={13} /></button>
        </div>
      </div>

      <div className="cal-weekdays">
        {WEEKDAYS.map((w) => <div key={w} className="cal-weekday">{w}</div>)}
      </div>

      <div className="cal-grid">
        {grid.map((day) => {
          const key = dateKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = isSameDay(day, today);
          return (
            <div
              key={key}
              className={`cal-cell${inMonth ? '' : ' cal-cell-out'}${isToday ? ' cal-cell-today' : ''}`}
              onClick={() => openCreate(day)}
            >
              <div className="cal-cell-head">
                <span className="cal-cell-num">{day.getDate()}</span>
                <button className="cal-cell-add" onClick={(e) => { e.stopPropagation(); openCreate(day); }} title="Добавить событие"><Icon name="add" size={11} /></button>
              </div>
              <div className="cal-cell-events">
                {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((ev) => (
                  <div
                    key={ev.id}
                    className="cal-event"
                    style={{ background: `${ev.color}1f`, borderLeftColor: ev.color }}
                    onClick={(e) => { e.stopPropagation(); openEdit(day, ev); }}
                  >
                    {ev.time && <span className="cal-event-time">{ev.time}</span>}
                    <span className="cal-event-title">{ev.title}</span>
                  </div>
                ))}
                {dayEvents.length > MAX_VISIBLE_EVENTS && (
                  <div className="cal-event-more">+{dayEvents.length - MAX_VISIBLE_EVENTS} ещё</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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

/* ─── EventModal ─────────────────────────────────────────────────────────── */
interface EventModalProps {
  date: Date;
  event: CalEvent | null;
  onSave: (data: { id?: string; date: string; title: string; time?: string; color: string; note?: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function EventModal({ date, event, onSave, onDelete, onClose }: EventModalProps) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [time,  setTime]  = useState(event?.time ?? '');
  const [color, setColor] = useState(event?.color ?? EVENT_COLORS[0]);
  const [note,  setNote]  = useState(event?.note ?? '');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

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
    <div className="cal-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cal-modal" onKeyDown={onKeyDown}>
        <div className="cal-modal-header">
          <span className="cal-modal-date">{date.getDate()} {MONTHS[date.getMonth()]} {date.getFullYear()}</span>
          <button className="cal-modal-close" onClick={onClose}><Icon name="close" size={13} /></button>
        </div>

        <input
          ref={titleRef}
          className="cal-input cal-input-title"
          placeholder="Название события"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="cal-modal-row">
          <input type="time" className="cal-input" value={time} onChange={(e) => setTime(e.target.value)} />
          <div className="cal-colors">
            {EVENT_COLORS.map((c) => (
              <button
                key={c}
                className={`cal-color-swatch${color === c ? ' active' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <textarea
          className="cal-input cal-textarea"
          placeholder="Описание (необязательно)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />

        <div className="cal-modal-actions">
          {onDelete && <button className="cal-btn cal-btn-del" onClick={onDelete}>Удалить</button>}
          <div style={{ flex: 1 }} />
          <button className="cal-btn" onClick={onClose}>Отмена</button>
          <button className="cal-btn cal-btn-primary" onClick={handleSave} disabled={!title.trim()}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

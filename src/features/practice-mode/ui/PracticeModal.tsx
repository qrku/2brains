'use client';

import { useState, useEffect } from 'react';
import { Modal, Button } from 'mikro-ui';
import type { Question } from '@/entities/interview';
import { Icon } from '@/shared/ui/Icon';

type Result = 'knew' | 'didnt';

interface Session {
  queue: Question[];
  idx: number;
  showAnswer: boolean;
  results: Record<string, Result>;
}

function makeSession(questions: Question[]): Session {
  return { queue: [...questions], idx: 0, showAnswer: false, results: {} };
}

const TIMER_OPTIONS = [
  { sec: 0,   label: 'Выкл' },
  { sec: 60,  label: '1 мин' },
  { sec: 120, label: '2 мин' },
  { sec: 180, label: '3 мин' },
];

interface Props {
  title: string;
  questions: Question[];
  onClose: () => void;
}

export function PracticeModal({ title, questions, onClose }: Props) {
  const [session, setSession] = useState<Session>(() => makeSession(questions));
  const [timerDuration, setTimerDuration] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const { queue, idx, showAnswer, results } = session;
  const isDone      = idx >= queue.length;
  const current     = queue[idx];
  const pct         = queue.length ? Math.round((idx / queue.length) * 100) : 0;
  const knewCount   = Object.values(results).filter((r) => r === 'knew').length;
  const didntList   = queue.filter((q) => results[q.id] === 'didnt');
  const timerPct    = timerDuration > 0 ? (timeLeft / timerDuration) * 100 : 100;
  const timerExpired = timerDuration > 0 && timeLeft === 0 && !showAnswer;

  // Reset countdown when question changes or duration changes
  useEffect(() => {
    setTimeLeft(timerDuration);
  }, [idx, timerDuration]);

  // Countdown tick
  useEffect(() => {
    if (timerDuration === 0 || showAnswer || isDone || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timerDuration, showAnswer, isDone, timeLeft]);

  const answer = (result: Result) =>
    setSession((s) => ({
      ...s,
      idx: s.idx + 1,
      showAnswer: false,
      results: { ...s.results, [current.id]: result },
    }));

  const restart = (qs: Question[]) => {
    setSession(makeSession(qs));
    setTimeLeft(timerDuration);
  };

  const modalTitle = isDone
    ? 'Результаты'
    : `${title} · ${idx + 1} / ${queue.length}`;

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Modal open onClose={onClose} title={modalTitle} size="md">
      {!isDone ? (
        <>
          {/* Main progress bar — flush under modal header */}
          <div className="practice-progress-track">
            <div className="practice-progress-fill" style={{ width: `${pct}%` }} />
          </div>

          {/* Timer row */}
          <div className="timer-row">
            <span className="timer-label">Таймер</span>
            <div className="timer-opts">
              {TIMER_OPTIONS.map(({ sec, label }) => (
                <button
                  key={sec}
                  className={`timer-opt${timerDuration === sec ? ' active' : ''}`}
                  onClick={() => setTimerDuration(sec)}
                >
                  {label}
                </button>
              ))}
            </div>
            {timerDuration > 0 && (
              <span className={`timer-countdown${timerExpired ? ' expired' : ''}`}>
                {fmt(timeLeft)}
              </span>
            )}
          </div>

          {/* Timer depletion bar */}
          {timerDuration > 0 && (
            <div className="timer-bar-track">
              <div
                className={`timer-bar-fill${timerExpired ? ' expired' : ''}`}
                style={{ width: `${timerPct}%`, transition: timeLeft < timerDuration ? 'width 1s linear' : 'none' }}
              />
            </div>
          )}

          <p className="practice-q-label">Вопрос</p>
          <p className="practice-q-text">{current.question}</p>

          {!showAnswer ? (
            <Button
              variant="outline"
              onClick={() => setSession((s) => ({ ...s, showAnswer: true }))}
            >
              Показать ответ
            </Button>
          ) : (
            <>
              <div className="practice-divider" />
              <p className="practice-a-label">Ответ</p>
              <p className="practice-a-text">{current.answer}</p>
              <div className="practice-actions">
                <Button variant="outline" onClick={() => answer('didnt')}><Icon name="close" size={12} /> Не знал</Button>
                <Button onClick={() => answer('knew')}><Icon name="check-circle-1" size={12} /> Знал</Button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="results-score">
            <div className="results-big">
              {knewCount}
              <span style={{ fontSize: '0.5em', fontWeight: 400, color: '#999' }}>
                /{queue.length}
              </span>
            </div>
            <div className="results-pct">
              {queue.length ? Math.round((knewCount / queue.length) * 100) : 0}% правильных ответов
            </div>
          </div>

          {didntList.length > 0 && (
            <div className="results-wrong">
              <p className="results-wrong-title">Не знал ({didntList.length})</p>
              <ul className="results-wrong-list">
                {didntList.map((q) => (
                  <li key={q.id}>{q.question}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="results-actions">
            {didntList.length > 0 && (
              <Button variant="outline" onClick={() => restart(didntList)}>
                Повторить ошибки ({didntList.length})
              </Button>
            )}
            <Button onClick={() => restart(questions)}>Начать заново</Button>
            <Button variant="ghost" onClick={onClose}>Закрыть</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

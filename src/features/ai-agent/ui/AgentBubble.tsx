'use client';

import { useEffect, useState } from 'react';

export interface AgentBubbleProps {
  /** Открыта ли панель чата — пока открыта, моргание глаз на паузе. */
  isOpen: boolean;
  /** Клик по кружку — открыть/закрыть панель. */
  onToggle: () => void;
  /** Агент сейчас выполняет запрос — показывает индикатор поверх кружка. */
  isWorking?: boolean;
}

/**
 * Круглая плавающая кнопка с двумя глазами-овалами (мотив логотипа),
 * открывающая панель чата с ИИ-агентом.
 *
 * Моргание — чистый CSS (`@keyframes oval-blink`, тот же, что на лендинге),
 * без единого requestAnimationFrame/setInterval. Единственный JS-хук —
 * слушатель `visibilitychange`, который ставит анимацию на паузу, когда
 * вкладка не видна: он вешается один раз и просто переключает класс.
 */
export function AgentBubble({ isOpen, onToggle, isWorking = false }: AgentBubbleProps) {
  const [pageHidden, setPageHidden] = useState(false);

  useEffect(() => {
    const onVisibilityChange = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const paused = isOpen || pageHidden;

  const label = isOpen
    ? 'Закрыть панель ИИ-агента'
    : isWorking
      ? 'ИИ-агент работает — открыть панель'
      : 'Открыть панель ИИ-агента';

  return (
    <button
      type="button"
      className={`agent-bubble${isOpen ? ' agent-bubble--open' : ''}${paused ? ' agent-bubble--paused' : ''}`}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={isOpen}
    >
      <span className="agent-bubble-eye agent-bubble-eye--l" aria-hidden="true" />
      <span className="agent-bubble-eye agent-bubble-eye--r" aria-hidden="true" />
      {isWorking && <span className="agent-bubble-badge" aria-hidden="true" />}
    </button>
  );
}

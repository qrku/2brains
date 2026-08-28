'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAgentChat } from '../model/useAgentChat';
import { AgentBubble } from './AgentBubble/AgentBubble';
import { AgentPanel } from './AgentPanel/AgentPanel';

/**
 * Кружок агента и панель чата — монтируются один раз на всё приложение.
 *
 * `useAgentChat` живёт здесь, а не в панели: панель размонтируется на закрытии, и её
 * собственный экземпляр хука обнулял бы переписку при каждом клике по кружку.
 */
export function AgentWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const chat = useAgentChat();

  // На лендинге агента нет — там нет ни воркспейса, ни данных, к которым он мог бы обратиться.
  if (pathname === '/') return null;

  return (
    <>
      <AgentPanel open={open} onClose={() => setOpen(false)} chat={chat} />
      <AgentBubble
        isOpen={open}
        onToggle={() => setOpen((v) => !v)}
        isWorking={chat.status === 'streaming'}
      />
    </>
  );
}

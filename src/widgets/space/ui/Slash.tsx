'use client';

import type { RefObject } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { filterCmds } from '../model/slash/consts';
import type { Cmd, SlashState } from '../model/slash/types';

interface SlashProps {
  slash: SlashState | null;
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (cmd: Cmd) => void;
  menuRef: RefObject<HTMLDivElement | null>;
}

/* ── Keep the slash menu on-screen when the caret is near a viewport edge ── */
function slashMenuStyle(slash: SlashState): React.CSSProperties {
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const style: React.CSSProperties = { left: Math.max(margin, Math.min(slash.left, vw - 250)) };
  const spaceBelow = vh - slash.top - margin;
  if (spaceBelow >= 150) {
    style.top = slash.top;
    style.maxHeight = Math.min(340, spaceBelow);
  } else {
    // Not enough room below the caret — pin the menu to the bottom of the viewport instead.
    style.bottom = margin;
    style.maxHeight = Math.min(340, vh - margin * 2);
  }
  return style;
}

export default function Slash({ slash, activeIndex, onHover, onSelect, menuRef }: SlashProps) {
  if (!slash) return null;

  const filteredCmds = filterCmds(slash.query);
  if (filteredCmds.length === 0) return null;

  const grouped = filteredCmds.reduce<Record<string, Cmd[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div ref={menuRef} className="slash-menu" style={slashMenuStyle(slash)}>
      {Object.entries(grouped).map(([group, cmds]) => (
        <div key={group} className="slash-group">
          <div className="slash-group-label">{group}</div>
          {cmds.map((cmd) => {
            const idx = filteredCmds.indexOf(cmd);
            return (
              <div
                key={cmd.id}
                className={`slash-item${idx === activeIndex ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(cmd);
                }}
                onMouseEnter={() => onHover(idx)}
              >
                <span className="slash-icon">
                  {cmd.svgIcon ? (
                    <Icon
                      name={cmd.svgIcon}
                      size={15}
                      style={cmd.id === 'detail' ? { transform: 'rotate(-90deg)' } : undefined}
                    />
                  ) : (
                    cmd.icon
                  )}
                </span>
                <span className="slash-label">{cmd.label}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

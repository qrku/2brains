'use client';

import Link from 'next/link';
import { ALL_MODULES } from '@/entities/module';
import { useModulesStore } from '@/app/providers/ModulesStoreProvider';
import { Icon } from '@/shared/ui/Icon';

export function ModulesGrid() {
  const { state, dispatch } = useModulesStore();

  return (
    <div className="module-grid">
      {ALL_MODULES.map((mod) => {
        const on = state.enabled.includes(mod.id);
        return (
          <div
            key={mod.id}
            className={`module-card${on ? ' on' : ''}`}
            onClick={() => dispatch({ type: 'TOGGLE', id: mod.id })}
          >
            <div className="module-card-dot" />
            <div className="module-card-name">{mod.label}</div>
            <div className="module-card-desc">{mod.description}</div>
            <div className="module-card-status">
              {on ? <><Icon name="check-circle-1" size={10} /> Включён</> : 'Выключен'}
            </div>
            {on && (
              <Link
                href={mod.href}
                className="module-card-open"
                onClick={(e) => e.stopPropagation()}
              >
                Открыть <Icon name="arrow-forward-simple" size={10} />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

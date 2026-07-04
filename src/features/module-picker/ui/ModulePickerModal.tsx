'use client';

import { Modal } from 'mikro-ui';
import { ALL_MODULES } from '@/entities/module';
import { useModulesStore } from '@/app/providers/ModulesStoreProvider';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ModulePickerModal({ open, onClose }: Props) {
  const { state, dispatch } = useModulesStore();

  return (
    <Modal open={open} onClose={onClose} title="Модули">
      <p style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>
        Включи дополнительные разделы — они появятся в навигации
      </p>
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
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

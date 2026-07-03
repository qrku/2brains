'use client';

import { useExperienceStore } from '@/app/providers/ExperienceStoreProvider';
import { CreateExperienceButton } from '@/features/create-experience';
import { ExperienceListCard } from './ExperienceListCard';

export function ExperienceList() {
  const { state } = useExperienceStore();

  if (!state.hydrated) {
    return (
      <div>
        <div className="page-toolbar">
          <div className="skeleton" style={{ width: 160, height: 26, borderRadius: 3 }} />
        </div>
        <div className="iv-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="iv-card">
              <div className="iv-card-body">
                <div className="skeleton" style={{ width: 180, height: 14, marginBottom: 6, borderRadius: 3 }} />
                <div className="skeleton" style={{ width: 110, height: 12, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-toolbar">
        <CreateExperienceButton />
      </div>

      {state.experiences.length === 0 ? (
        <div className="empty-state">
          <p style={{ marginBottom: 4 }}>Проектов пока нет</p>
          <p>Добавь проект и опиши что делал, какие технологии использовал</p>
        </div>
      ) : (
        <div className="iv-list">
          {state.experiences.map((exp) => (
            <ExperienceListCard key={exp.id} experience={exp} />
          ))}
        </div>
      )}
    </div>
  );
}

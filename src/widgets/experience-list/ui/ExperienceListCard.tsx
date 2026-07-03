'use client';

import Link from 'next/link';
import { useExperienceStore } from '@/app/providers/ExperienceStoreProvider';
import type { Experience } from '@/entities/experience';

interface Props {
  experience: Experience;
}

export function ExperienceListCard({ experience }: Props) {
  const { dispatch } = useExperienceStore();
  const count = experience.points.length;

  const handleDelete = () => {
    if (!confirm(`Удалить «${experience.title}»?`)) return;
    dispatch({ type: 'DELETE_EXPERIENCE', id: experience.id });
  };

  return (
    <div className="iv-card">
      <div className="iv-card-body">
        <div className="iv-card-title">{experience.title}</div>
        <div className="iv-card-meta">
          {experience.period && <span>{experience.period} · </span>}
          <span>{count === 0 ? 'Нет пунктов' : `${count} ${pluralP(count)}`}</span>
        </div>
      </div>
      <div className="iv-card-actions">
        <Link href={`/experience/${experience.id}`} className="btn-link">
          Открыть
        </Link>
        <button className="icon-btn danger" title="Удалить" onClick={handleDelete}>
          ✕
        </button>
      </div>
    </div>
  );
}

function pluralP(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return 'пункт';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'пункта';
  return 'пунктов';
}

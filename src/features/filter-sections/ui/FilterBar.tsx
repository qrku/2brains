'use client';

import { Button } from 'mikro-ui';
import { usePrepStore, type Filter } from '@/app/providers/PrepStoreProvider';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'missing', label: 'Пробелы' },
  { id: 'high', label: 'Критичные' },
];

export function FilterBar() {
  const { state, dispatch } = usePrepStore();
  return (
    <div className="filters">
      {FILTERS.map((f) => (
        <Button
          key={f.id}
          variant={state.filter === f.id ? 'solid' : 'ghost'}
          size="sm"
          onClick={() => dispatch({ type: 'SET_FILTER', filter: f.id })}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}

'use client';

import { useUserPacksStore, builtinPacks } from '@/entities/pack';
import { CreatePackButton } from '@/features/create-pack';
import { BuiltinPackCard, UserPackCard } from './PackCard';

export function PackGrid() {
  const { state } = useUserPacksStore();

  return (
    <div>
      <div className="page-toolbar" style={{ marginBottom: 24 }}>
        <CreatePackButton />
      </div>

      <div className="pack-grid">
        {builtinPacks.map((pack) => (
          <BuiltinPackCard key={pack.id} pack={pack} />
        ))}
        {state.hydrated &&
          state.packs.map((pack) => (
            <UserPackCard key={pack.id} pack={pack} />
          ))}
      </div>
    </div>
  );
}

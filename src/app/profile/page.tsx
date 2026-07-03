'use client';

import { ProfileCard, ProfileStats, ActivePacks } from '@/widgets/profile';

export default function ProfilePage() {
  return (
    <main>
      <div className="container">
        <ProfileCard />
        <ProfileStats />
        <ActivePacks />
      </div>
    </main>
  );
}

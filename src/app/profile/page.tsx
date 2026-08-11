'use client';

import { ProfileCard, ProfileStats } from '@/widgets/profile';

export default function ProfilePage() {
  return (
    <main>
      <div className="container">
        <ProfileCard />
        <ProfileStats />
      </div>
    </main>
  );
}

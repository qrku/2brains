'use client';

import { useProfileStats } from '../../model/useProfileStats';
import styles from './ProfileStats.module.css';

export function ProfileStats() {
  const { workspaces, files, boards } = useProfileStats();

  return (
    <div className={styles['profile-stats']}>
      <div className={styles.metric}>
        <div className={styles['metric-label']}>Воркспейсов</div>
        <div className={styles['metric-val']}>{workspaces}</div>
      </div>
      <div className={styles.metric}>
        <div className={styles['metric-label']}>Файлов</div>
        <div className={styles['metric-val']}>{files}</div>
      </div>
      <div className={styles.metric}>
        <div className={styles['metric-label']}>Досок</div>
        <div className={styles['metric-val']}>{boards}</div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/shared/ui/Icon';
import { cx } from '@/shared/lib/cx';
import styles from './LandingClient.module.css';

export function LandingClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // В разработке лендинг открывается и залогиненным: иначе его не посмотреть,
    // не разлогинившись, — а правится он чаще всего именно с живой сессией.
    if (process.env.NODE_ENV === 'development') return;
    if (localStorage.getItem('auth_v1')) router.replace('/space');
  }, [router]);

  const submit = () => {
    if (!email.includes('@') || !email.includes('.')) {
      setError('Введи корректную почту');
      return;
    }
    setLoading(true);
    localStorage.setItem('auth_v1', email);
    router.push('/space');
  };

  return (
    <div className={styles['land-form-wrap']}>
      <div className={cx(styles['land-form'], error && styles.err)}>
        <input
          className={styles['land-input']}
          type="email"
          placeholder="Электронная почта"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button
          className={styles['land-btn']}
          onClick={submit}
          disabled={loading}
          aria-label="Начать"
        >
          <Icon name="arrow-forward" size={16} />
        </button>
      </div>
      {error && <p className={styles['land-error']}>{error}</p>}
    </div>
  );
}

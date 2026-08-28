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
    <>
      <div className={styles['land-form']}>
        <input
          className={cx(styles['land-input'], error && styles.err)}
          type="email"
          placeholder="Электронная почта"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        <button className={styles['land-btn']} onClick={submit} disabled={loading}>
          {loading ? (
            '...'
          ) : (
            <>
              Начать <Icon name="arrow-forward" size={12} />
            </>
          )}
        </button>
      </div>
      {error && <p className={styles['land-error']}>{error}</p>}
    </>
  );
}

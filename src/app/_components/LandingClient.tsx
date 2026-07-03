'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function LandingClient() {
  const router = useRouter();
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
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
      <div className="land-form">
        <input
          className={`land-input${error ? ' err' : ''}`}
          type="email"
          placeholder="Электронная почта"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        <button className="land-btn" onClick={submit} disabled={loading}>
          {loading ? '...' : 'Начать →'}
        </button>
      </div>
      {error && <p className="land-error">{error}</p>}
      <p className="land-hint">Только почта — никаких паролей пока</p>
    </>
  );
}

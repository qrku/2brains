'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const FEATURES = [
  {
    icon: '📝',
    title: 'Пространство',
    desc: 'Markdown-редактор с деревом файлов. Пиши в визуальном или текстовом режиме — всё сохраняется автоматически.',
  },
  {
    icon: '🗂️',
    title: 'Доска',
    desc: 'Бесконечный холст в стиле Miro. Размещай текст и блоки, соединяй стрелками, масштабируй жестами.',
  },
  {
    icon: '🧩',
    title: 'Модули',
    desc: 'Трекеры задач, опыта и откликов. Подключай только то, что нужно — лишнего в интерфейсе не будет.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [ready,  setReady]  = useState(false);
  const [email,  setEmail]  = useState('');
  const [error,  setError]  = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('auth_v1')) {
      router.replace('/space');
    } else {
      setReady(true);
    }
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

  if (!ready) return null;

  return (
    <div className="land">
      {/* Header */}
      <header className="land-header">
        <span className="land-logo-text">2brain</span>
      </header>

      {/* Hero */}
      <main className="land-hero">
        <div className="land-ovals" aria-hidden>
          <div className="land-oval land-oval-l" />
          <div className="land-oval land-oval-r" />
        </div>
        <h1 className="land-h1">Твой второй мозг</h1>
        <p className="land-sub">
          Пространство для знаний, идей и&nbsp;подготовки.<br />
          Всё в одном месте — редактор, доска, трекеры.
        </p>

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
      </main>

      {/* Features */}
      <section className="land-features">
        {FEATURES.map((f) => (
          <div key={f.title} className="land-feat">
            <span className="land-feat-icon">{f.icon}</span>
            <div className="land-feat-title">{f.title}</div>
            <div className="land-feat-desc">{f.desc}</div>
          </div>
        ))}
      </section>

      <footer className="land-footer">
        © 2brain · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

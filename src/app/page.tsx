import { LandingClient } from './_components/LandingClient';

export default function LandingPage() {
  return (
    <div className="land">
      <header className="land-header">
        <span className="land-logo-text">2brain</span>
      </header>

      <main className="land-hero">
        <div className="land-ovals" aria-hidden>
          <div className="land-oval land-oval-l" />
          <div className="land-oval land-oval-r" />
        </div>
        <h1 className="land-h1">Твой второй мозг</h1>
        <p className="land-sub">
          Пространство для знаний, идей и&nbsp;подготовки.
          <br />
          Всё в одном месте — редактор, доска, трекеры.
        </p>

        <LandingClient />
      </main>

      <footer className="land-footer">© 2brain · {new Date().getFullYear()}</footer>
    </div>
  );
}

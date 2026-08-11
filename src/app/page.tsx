import { LandingClient } from "./_components/LandingClient";

const FEATURES = [
  {
    icon: "📝",
    title: "Пространство",
    desc: "Markdown-редактор с деревом файлов. Пиши в визуальном или текстовом режиме — всё сохраняется автоматически.",
  },
  {
    icon: "🗂️",
    title: "Доска",
    desc: "Бесконечный холст в стиле Miro. Размещай текст и блоки, соединяй стрелками, масштабируй жестами.",
  },
  {
    icon: "🧩",
    title: "Модули",
    desc: "Трекеры задач, опыта и откликов. Подключай только то, что нужно — лишнего в интерфейсе не будет.",
  },
];

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

      <footer className="land-footer">
        © 2brain · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

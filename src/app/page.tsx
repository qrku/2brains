import { LandingClient } from './_components/LandingClient/LandingClient';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.land}>
      <header className={styles['land-header']}>
        <span className={styles['land-logo-text']}>2brain</span>
      </header>

      <main className={styles['land-hero']}>
        <div className={styles['land-ovals']} aria-hidden>
          <div className={`${styles['land-oval']} ${styles['land-oval-l']}`} />
          <div className={`${styles['land-oval']} ${styles['land-oval-r']}`} />
        </div>
        <h1 className={styles['land-h1']}>Твой второй мозг</h1>
        <p className={styles['land-sub']}>
          Пространство для знаний, идей и&nbsp;подготовки.
          <br />
          Всё в одном месте — редактор, доска, трекеры.
        </p>

        <LandingClient />
      </main>

      <footer className={styles['land-footer']}>© 2brain · {new Date().getFullYear()}</footer>
    </div>
  );
}

import { LandingClient } from './_components/LandingClient/LandingClient';
import { LandingScene } from './_components/LandingScene/LandingScene';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.land}>
      <header className={styles['land-header']}>
        <h1 className={styles['land-logo-text']}>2brains</h1>
        <p className={styles['land-sub']}>Координация знаний</p>
      </header>

      <main className={styles['land-hero']}>
        <LandingScene />
        <LandingClient />
      </main>

      <footer className={styles['land-footer']}>© 2brains · {new Date().getFullYear()}</footer>
    </div>
  );
}

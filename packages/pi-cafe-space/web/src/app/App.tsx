import { HashRouter, Route, Routes } from 'react-router';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './App.module.scss';

function Shell() {
  const { t, i18n } = useTranslation();
  return <main className={clsx(styles.shell)}>
    <header><h1>{t('appName')}</h1>
      <nav aria-label={t('language')}>
        <button type="button" onClick={() => void i18n.changeLanguage('zh-CN')}>中文</button>
        <button type="button" onClick={() => void i18n.changeLanguage('en')}>English</button>
      </nav>
    </header>
    <section className={styles.empty} aria-live="polite">
      <h2>{t('disconnected')}</h2><p>{t('description')}</p>
    </section>
  </main>;
}
export function App() {
  return <HashRouter><Routes><Route path="*" element={<Shell />} /></Routes></HashRouter>;
}

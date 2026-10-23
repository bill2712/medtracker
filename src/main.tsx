import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { I18nProvider, loadMessages, resolveInitialLang } from './i18n';
import './index.css';

const lang = resolveInitialLang();

loadMessages(lang).then((messages) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider initialLang={lang} initialMessages={messages}>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is optional */
    });
  });
}

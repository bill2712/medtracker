import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getLanguage, isLang, langFromPath, matchLanguage, type Lang } from './config';
import { createFormatter, fmt, type Formatter } from './format';
import type { Messages } from './locales/en';
import { safePushState, storage } from '../lib/safeStorage';

const loaders: Record<Lang, () => Promise<{ default: Messages }>> = {
  en: () => import('./locales/en'),
  'zh-Hant': () => import('./locales/zh-Hant'),
  'zh-Hans': () => import('./locales/zh-Hans'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
};

const LANG_KEY = 'mt.lang';
const BASE = import.meta.env.BASE_URL || '/';

export const loadMessages = (lang: Lang) => loaders[lang]().then((m) => m.default);

/** URL path language first, then the saved choice, then the browser's languages. */
export function resolveInitialLang(): Lang {
  const fromPath = langFromPath(window.location.pathname, BASE);
  if (fromPath) return fromPath;
  const stored = storage.get(LANG_KEY);
  if (isLang(stored)) return stored;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  return matchLanguage(tags);
}

export const pathForLang = (lang: Lang) => `${BASE}${getLanguage(lang).slug}/`;

type I18nValue = {
  lang: Lang;
  m: Messages;
  f: Formatter;
  t: typeof fmt;
  setLang: (lang: Lang) => Promise<void>;
};

const I18nContext = createContext<I18nValue | null>(null);

function applyDocumentLang(lang: Lang, m: Messages) {
  const html = document.documentElement;
  html.lang = lang;
  document.querySelector('meta[name="description"]')?.setAttribute('content', m.seo.description);
}

export function I18nProvider({
  initialLang,
  initialMessages,
  children,
}: {
  initialLang: Lang;
  initialMessages: Messages;
  children: ReactNode;
}) {
  const [state, setState] = useState({ lang: initialLang, m: initialMessages });

  const switchTo = useCallback(async (lang: Lang, updateUrl: boolean) => {
    const m = await loadMessages(lang);
    setState({ lang, m });
    if (updateUrl) {
      storage.set(LANG_KEY, lang);
      const url = pathForLang(lang) + window.location.search + window.location.hash;
      safePushState({ lang }, url);
    }
  }, []);

  // Follow back/forward navigation between language URLs.
  useEffect(() => {
    const onPop = () => {
      const fromPath = langFromPath(window.location.pathname, BASE);
      if (fromPath && fromPath !== state.lang) void switchTo(fromPath, false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [state.lang, switchTo]);

  useEffect(() => applyDocumentLang(state.lang, state.m), [state]);

  const value = useMemo<I18nValue>(
    () => ({
      lang: state.lang,
      m: state.m,
      f: createFormatter(state.m, getLanguage(state.lang).intl),
      t: fmt,
      setLang: (lang: Lang) => switchTo(lang, true),
    }),
    [state, switchTo],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

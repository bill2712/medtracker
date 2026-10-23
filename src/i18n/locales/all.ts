// Eager map of every locale. Used at build time (SEO pages) — the app itself lazy-loads locales.
import type { Lang } from '../config';
import type { Messages } from './en';
import en from './en';
import zhHant from './zh-Hant';
import zhHans from './zh-Hans';
import ja from './ja';
import ko from './ko';
import es from './es';
import fr from './fr';

export const ALL_MESSAGES: Record<Lang, Messages> = {
  en,
  'zh-Hant': zhHant,
  'zh-Hans': zhHans,
  ja,
  ko,
  es,
  fr,
};

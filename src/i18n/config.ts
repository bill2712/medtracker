export const LANGUAGES = [
  { code: 'en', slug: 'en', label: 'English', intl: 'en', ogLocale: 'en_US' },
  { code: 'zh-Hant', slug: 'zh-hant', label: '繁體中文', intl: 'zh-HK', ogLocale: 'zh_HK' },
  { code: 'zh-Hans', slug: 'zh-hans', label: '简体中文', intl: 'zh-CN', ogLocale: 'zh_CN' },
  { code: 'ja', slug: 'ja', label: '日本語', intl: 'ja-JP', ogLocale: 'ja_JP' },
  { code: 'ko', slug: 'ko', label: '한국어', intl: 'ko-KR', ogLocale: 'ko_KR' },
  { code: 'es', slug: 'es', label: 'Español', intl: 'es', ogLocale: 'es_ES' },
  { code: 'fr', slug: 'fr', label: 'Français', intl: 'fr', ogLocale: 'fr_FR' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['code'];
export type LanguageInfo = (typeof LANGUAGES)[number];

export const DEFAULT_LANG: Lang = 'en';

export const getLanguage = (code: Lang): LanguageInfo =>
  LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

export const isLang = (value: unknown): value is Lang =>
  typeof value === 'string' && LANGUAGES.some((l) => l.code === value);

/** Language encoded in the first path segment, e.g. `/zh-hant/` → `zh-Hant`. */
export function langFromPath(pathname: string, base = '/'): Lang | null {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '');
  const segment = rest.split('/')[0]?.toLowerCase();
  if (!segment) return null;
  return LANGUAGES.find((l) => l.slug === segment)?.code ?? null;
}

/** Best match for a list of BCP 47 tags such as `navigator.languages`. */
export function matchLanguage(tags: readonly string[]): Lang {
  for (const raw of tags) {
    const tag = raw.toLowerCase();
    if (tag.startsWith('zh')) {
      if (/hant|-hk|-tw|-mo/.test(tag)) return 'zh-Hant';
      return 'zh-Hans';
    }
    const primary = tag.split('-')[0];
    const found = LANGUAGES.find((l) => l.code.toLowerCase() === primary);
    if (found) return found.code;
  }
  return DEFAULT_LANG;
}

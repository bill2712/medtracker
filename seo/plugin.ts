/**
 * Build-time SEO: renders a localized <head> (title, description, hreflang, Open Graph,
 * JSON-LD) and crawlable fallback content for every language, emits one HTML page per
 * language (`/zh-hant/index.html`, …) plus `sitemap.xml` and `robots.txt`.
 */
import type { Plugin } from 'vite';
import { DEFAULT_LANG, LANGUAGES, langFromPath, type Lang } from '../src/i18n/config';
import { ALL_MESSAGES } from '../src/i18n/locales/all';

type Target = { lang: Lang; path: string; isRoot: boolean };

const HEAD_MARKER = '<!--seo-head-->';
const BODY_MARKER = '<!--seo-body-->';
const LANG_MARKER = '__APP_LANG__';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

/** Extra regional hreflang codes that should land on a script-based page. */
const REGIONAL_ALIASES: Partial<Record<Lang, string[]>> = {
  'zh-Hant': ['zh-HK', 'zh-TW', 'zh-MO'],
  'zh-Hans': ['zh-CN', 'zh-SG'],
};

export function resolveSiteUrl(env: Record<string, string | undefined>): string {
  const raw = (env.SITE_URL || env.APP_URL || '').trim();
  if (!raw || raw.startsWith('MY_') || !/^https?:\/\//.test(raw)) return '';
  return raw.replace(/\/+$/, '');
}

export function seoPlugin(options: { siteUrl: string }): Plugin {
  const { siteUrl } = options;
  let base = '/';
  let isBuild = false;

  const langPath = (lang: Lang) => `${base}${LANGUAGES.find((l) => l.code === lang)!.slug}/`;
  const abs = (path: string) => (siteUrl ? `${siteUrl}${path}` : path);

  function renderHead(t: Target): string {
    const m = ALL_MESSAGES[t.lang];
    const info = LANGUAGES.find((l) => l.code === t.lang)!;
    const url = abs(t.path);
    const image = abs(`${base}og-image.png`);

    const alternates = LANGUAGES.flatMap((l) =>
      [l.code, ...(REGIONAL_ALIASES[l.code] ?? [])].map(
        (code) => `<link rel="alternate" hreflang="${code}" href="${esc(abs(langPath(l.code)))}" />`,
      ),
    );
    alternates.push(`<link rel="alternate" hreflang="x-default" href="${esc(abs(base))}" />`);

    const structured = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: m.app.name,
        alternateName: m.app.tagline,
        url,
        description: m.seo.description,
        applicationCategory: 'HealthApplication',
        applicationSubCategory: 'Medication reminder',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript. Works offline after the first visit.',
        inLanguage: t.lang,
        availableLanguage: LANGUAGES.map((l) => l.code),
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: m.seo.features.map((f) => `${f.title}: ${f.text}`),
        image,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: t.lang,
        mainEntity: m.seo.faq.map((q) => ({
          '@type': 'Question',
          name: q.q,
          acceptedAnswer: { '@type': 'Answer', text: q.a },
        })),
      },
    ];

    return [
      `<title>${esc(m.seo.title)}</title>`,
      `<meta name="description" content="${esc(m.seo.description)}" />`,
      `<meta name="keywords" content="${esc(m.seo.keywords)}" />`,
      `<meta name="robots" content="index, follow, max-image-preview:large" />`,
      `<link rel="canonical" href="${esc(url)}" />`,
      ...alternates,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${esc(m.app.name)}" />`,
      `<meta property="og:title" content="${esc(m.seo.title)}" />`,
      `<meta property="og:description" content="${esc(m.seo.description)}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta property="og:image" content="${esc(image)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${esc(`${m.app.name} – ${m.app.tagline}`)}" />`,
      `<meta property="og:locale" content="${info.ogLocale}" />`,
      ...LANGUAGES.filter((l) => l.code !== t.lang).map((l) => `<meta property="og:locale:alternate" content="${l.ogLocale}" />`),
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(m.seo.title)}" />`,
      `<meta name="twitter:description" content="${esc(m.seo.description)}" />`,
      `<meta name="twitter:image" content="${esc(image)}" />`,
      `<script type="application/ld+json">${jsonLd(structured)}</script>`,
    ]
      .map((line) => `    ${line}`)
      .join('\n');
  }

  /** Static content shown before the app boots (and to crawlers without JavaScript). */
  function renderBody(t: Target): string {
    const m = ALL_MESSAGES[t.lang];
    const features = m.seo.features
      .map((f) => `<li><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`)
      .join('');
    const faq = m.seo.faq.map((q) => `<dt>${esc(q.q)}</dt><dd>${esc(q.a)}</dd>`).join('');
    const langs = LANGUAGES.map(
      (l) => `<a href="${esc(langPath(l.code))}" hreflang="${l.code}" lang="${l.code}">${esc(l.label)}</a>`,
    ).join(' · ');
    return `
      <div class="seo-fallback">
        <p class="seo-brand">💊 ${esc(m.app.name)}</p>
        <h1>${esc(m.seo.h1)}</h1>
        <p class="seo-intro">${esc(m.seo.intro)}</p>
        <h2>${esc(m.seo.featuresTitle)}</h2>
        <ul class="seo-features">${features}</ul>
        <h2>${esc(m.seo.faqTitle)}</h2>
        <dl class="seo-faq">${faq}</dl>
        <p class="seo-note">${esc(m.settings.disclaimer)}</p>
        <nav class="seo-langs" aria-label="${esc(m.settings.language)}">${langs}</nav>
      </div>
    `;
  }

  const render = (html: string, t: Target) =>
    html.replace(LANG_MARKER, t.lang).replace(HEAD_MARKER, renderHead(t)).replace(BODY_MARKER, renderBody(t));

  const rootTarget = (): Target => ({ lang: DEFAULT_LANG, path: base, isRoot: true });

  function sitemap(): string {
    const today = new Date().toISOString().slice(0, 10);
    const links = [
      ...LANGUAGES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${abs(langPath(l.code))}" />`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(base)}" />`,
    ].join('\n');
    const urls = [abs(base), ...LANGUAGES.map((l) => abs(langPath(l.code)))]
      .map(
        (loc, i) =>
          `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${i === 0 ? '1.0' : '0.9'}</priority>\n${links}\n  </url>`,
      )
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
  }

  return {
    name: 'medtracker-seo',
    enforce: 'post',
    configResolved(config) {
      base = config.base || '/';
      isBuild = config.command === 'build';
      if (isBuild && !siteUrl) {
        config.logger.warn(
          '[seo] SITE_URL (or APP_URL) is not set: canonical/hreflang URLs will be relative and sitemap.xml is skipped.',
        );
      }
    },
    transformIndexHtml(html, ctx) {
      if (isBuild) return html; // pages are rendered per language in generateBundle
      const path = (ctx.originalUrl ?? '/').split(/[?#]/)[0];
      const lang = langFromPath(path, base);
      return render(html, lang ? { lang, path: langPath(lang), isRoot: false } : rootTarget());
    },
    generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') {
        this.error('[seo] index.html not found in bundle');
        return;
      }
      const template = String(index.source);
      index.source = render(template, rootTarget());
      for (const l of LANGUAGES) {
        this.emitFile({
          type: 'asset',
          fileName: `${l.slug}/index.html`,
          source: render(template, { lang: l.code, path: langPath(l.code), isRoot: false }),
        });
      }
      if (siteUrl) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}${base}sitemap.xml\n` : ''}`,
      });
    },
  };
}

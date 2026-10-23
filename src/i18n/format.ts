import type { Messages, Plural } from './locales/en';
import type { MedForm } from '../types';

/** Replace `{name}` placeholders. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(vars[key]) : `{${key}}`));
}

export function createFormatter(messages: Messages, intlLocale: string) {
  const pluralRules = new Intl.PluralRules(intlLocale);
  const numberFmt = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 });
  const timeFmt = new Intl.DateTimeFormat(intlLocale, { hour: 'numeric', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric' });
  const weekdayFmt = new Intl.DateTimeFormat(intlLocale, { weekday: 'short' });
  const longDateFmt = new Intl.DateTimeFormat(intlLocale, { weekday: 'long', month: 'long', day: 'numeric' });
  const listFmt =
    typeof Intl.ListFormat === 'function'
      ? new Intl.ListFormat(intlLocale, { style: 'short', type: 'conjunction' })
      : null;

  const plural = (p: Plural, count: number, vars: Record<string, string | number> = {}) => {
    const rule = pluralRules.select(count);
    const template = rule === 'one' ? p.one : p.other;
    return fmt(template, { count: numberFmt.format(count), ...vars });
  };

  const number = (n: number) => numberFmt.format(n);

  const amount = (n: number, form: MedForm) =>
    fmt(messages.units.amount, { n: numberFmt.format(n), unit: plural(messages.units[form], n) });

  const time = (d: Date) => timeFmt.format(d);
  const date = (d: Date) => dateFmt.format(d);
  const weekday = (d: Date) => weekdayFmt.format(d);
  const longDate = (d: Date) => longDateFmt.format(d);

  const dayDiff = (d: Date, now: Date) => {
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((a - b) / 86_400_000);
  };

  /** "today 8:00 PM", "tomorrow 8:00", or "Oct 24 8:00". */
  const relativeDateTime = (d: Date, now = new Date()) => {
    const diff = dayDiff(d, now);
    const t = time(d);
    if (diff === 0) return fmt(messages.time.today, { time: t });
    if (diff === 1) return fmt(messages.time.tomorrow, { time: t });
    if (diff === -1) return fmt(messages.time.yesterday, { time: t });
    return `${date(d)} ${t}`;
  };

  /** "Today", "Yesterday" or the full date. */
  const dayLabel = (d: Date, now = new Date()) => {
    const diff = dayDiff(d, now);
    if (diff === 0) return messages.time.todayLabel;
    if (diff === -1) return messages.time.yesterdayLabel;
    return longDate(d);
  };

  const duration = (ms: number) => {
    const totalMin = Math.max(0, Math.round(ms / 60_000));
    if (totalMin < 1) return messages.time.lessThanMinute;
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return fmt(messages.time.d, { d, h });
    if (h > 0) return fmt(messages.time.h, { h, m });
    return fmt(messages.time.m, { m });
  };

  const rtf = typeof Intl.RelativeTimeFormat === 'function' ? new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' }) : null;
  /** Countdown to a future moment: exact under two days ("in 5 h 20 min"), whole days after ("in 12 days"). */
  const until = (ms: number, inTemplate: string) => {
    if (ms >= 2 * 86_400_000 && rtf) return rtf.format(Math.round(ms / 86_400_000), 'day');
    return fmt(inTemplate, { duration: duration(ms) });
  };

  const list = (items: string[]) => (listFmt ? listFmt.format(items) : items.join(messages.time.listSep));

  /** "08:00" (24h string) → localised clock time. */
  const clock = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return time(d);
  };

  return { plural, number, amount, time, date, weekday, longDate, relativeDateTime, dayLabel, duration, until, list, clock };
}

export type Formatter = ReturnType<typeof createFormatter>;

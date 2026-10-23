import type { Medication } from '../types';
import type { Messages } from '../i18n/locales/en';
import { fmt, type Formatter } from '../i18n/format';
import { remaining, sortTimes, tracksSupply } from './schedule';

export function scheduleText(m: Medication, msgs: Messages, f: Formatter): string {
  const s = m.schedule;
  if (s.type === 'interval') return f.plural(msgs.schedule.everyHours, s.hours);
  if (s.type === 'times') return fmt(msgs.schedule.dailyAt, { times: f.list(sortTimes(s.times).map(f.clock)) });
  return f.plural(msgs.schedule.asNeeded, s.minHours);
}

export const displayName = (m: Medication) => (m.strength ? `${m.name} ${m.strength}` : m.name);

/** Plain-text medication list for sharing with family, a doctor or a pharmacist. */
export function shareSummary(meds: Medication[], msgs: Messages, f: Formatter): string {
  const lines = meds.map((m) => {
    const parts = [
      fmt(msgs.card.perDose, { amount: f.amount(m.dosage, m.form) }),
      scheduleText(m, msgs, f),
    ];
    if (m.instructions !== 'none') parts.push(msgs.instructions[m.instructions]);
    if (tracksSupply(m)) parts.push(fmt(msgs.card.left, { amount: f.amount(remaining(m), m.form) }));
    const note = m.notes.trim() ? `\n   ${m.notes.trim()}` : '';
    return `• ${displayName(m)} — ${parts.join(' · ')}${note}`;
  });
  return [`${msgs.share.title} (${f.longDate(new Date())})`, '', ...lines, '', `— ${msgs.share.generated}`].join('\n');
}

import type { Appointment, DoctorNote, Medication } from '../types';
import type { Messages } from '../i18n/locales/en';
import { fmt, type Formatter } from '../i18n/format';
import { addDays, DAY, HOUR, isCompleted, isLowStock, lastTakenLog, startOfDay, summarizeDay } from './schedule';
import { displayName, scheduleText } from './describe';

/** An appointment stays "current" for a few hours after it starts (you may still be at the clinic). */
const CURRENT_FOR = 3 * HOUR;

const ts = (a: Appointment) => Date.parse(a.time);

export const isUpcoming = (a: Appointment, now: number) => !a.done && ts(a) > now - CURRENT_FOR;
export const isHappening = (a: Appointment, now: number) => !a.done && ts(a) <= now && ts(a) > now - CURRENT_FOR;

export const upcomingAppointments = (appts: Appointment[], now: number) =>
  appts.filter((a) => isUpcoming(a, now)).sort((a, b) => ts(a) - ts(b));

export const pastAppointments = (appts: Appointment[], now: number) =>
  appts.filter((a) => !isUpcoming(a, now)).sort((a, b) => ts(b) - ts(a));

export const nextAppointment = (appts: Appointment[], now: number) => upcomingAppointments(appts, now)[0] ?? null;

/** Notes still to bring up, plus the ones already ticked off at this appointment. */
export const notesForVisit = (notes: DoctorNote[], appt: Appointment | null) =>
  notes.filter((n) => !n.resolved || (appt && n.apptId === appt.id));

export const openNotes = (notes: DoctorNote[]) => notes.filter((n) => !n.resolved);

/** Start of the medication review: the last attended visit (max 90 days back), else 30 days. */
export function reviewStart(appts: Appointment[], now: number): number {
  const last = appts
    .filter((a) => a.done && ts(a) < now)
    .map(ts)
    .sort((a, b) => b - a)[0];
  if (last) return Math.max(last, now - 90 * DAY);
  return now - 30 * DAY;
}

export type MedReview = {
  med: Medication;
  taken: number;
  skipped: number;
  expected: number;
  adherence: number | null;
};

export function reviewMed(med: Medication, from: number, now: number): MedReview {
  const r: MedReview = { med, taken: 0, skipped: 0, expected: 0, adherence: null };
  let onTrack = 0;
  for (let day = startOfDay(from); day.getTime() <= now; day = addDays(day, 1)) {
    const s = summarizeDay([med], day, now);
    r.taken += s.taken;
    r.skipped += s.skipped;
    r.expected += s.expectedSoFar;
    onTrack += s.onTrack;
  }
  if (r.expected) r.adherence = onTrack / r.expected;
  return r;
}

/** Medications worth reviewing: active ones and those used or finished since `from`. */
export function medsToReview(meds: Medication[], from: number): Medication[] {
  return meds.filter((m) => {
    if (!isCompleted(m)) return true;
    const last = lastTakenLog(m);
    return !!last && Date.parse(last.time) >= from;
  });
}

/** Talking points derived from the medication records. */
export function suggestions(reviews: MedReview[], msgs: Messages, from: number): string[] {
  const out: string[] = [];
  for (const r of reviews) {
    const name = displayName(r.med);
    const prn = r.med.schedule.type === 'asNeeded';
    if (!prn && r.adherence !== null && r.expected >= 3 && r.adherence < 0.9) out.push(fmt(msgs.prep.sugAdherence, { name }));
    if (prn && r.taken >= 3) out.push(fmt(msgs.prep.sugPrn, { name, count: r.taken }));
    if (isLowStock(r.med)) out.push(fmt(msgs.prep.sugRefill, { name }));
    const last = lastTakenLog(r.med);
    if (isCompleted(r.med) && last && Date.parse(last.time) >= from) out.push(fmt(msgs.prep.sugCompleted, { name }));
  }
  return out;
}

export function apptTitle(a: Appointment) {
  return a.clinic ? `${a.doctor} · ${a.clinic}` : a.doctor;
}

/** Plain-text visit summary to share with the doctor or a carer. */
export function visitSummaryText(
  appt: Appointment | null,
  notes: DoctorNote[],
  reviews: MedReview[],
  from: number,
  meds: Medication[],
  msgs: Messages,
  f: Formatter,
): string {
  const lines: string[] = [];
  const header = appt ? `${msgs.prep.title}: ${apptTitle(appt)} — ${f.longDate(new Date(appt.time))} ${f.time(new Date(appt.time))}` : msgs.prep.title;
  lines.push(header);
  if (appt?.location) lines.push(appt.location);

  const medName = (id?: string) => meds.find((m) => m.id === id);
  const open = notes.filter((n) => !n.resolved);
  const tips = suggestions(reviews, msgs, from);
  if (open.length || tips.length) {
    lines.push('', `${msgs.prep.toRaise}:`);
    for (const n of open) {
      const med = medName(n.medId);
      lines.push(`• [${msgs.notes[n.kind]}] ${n.text}${med ? ` (${displayName(med)})` : ''} — ${f.date(new Date(n.createdAt))}`);
    }
    for (const t of tips) lines.push(`• ${t}`);
  }

  if (reviews.length) {
    lines.push('', `${msgs.prep.meds} (${fmt(msgs.prep.since, { date: f.date(new Date(from)) })}):`);
    for (const r of reviews) {
      const parts = [fmt(msgs.card.perDose, { amount: f.amount(r.med.dosage, r.med.form) }), scheduleText(r.med, msgs, f)];
      if (r.med.schedule.type === 'asNeeded') parts.push(f.plural(msgs.prep.prnUses, r.taken));
      else if (r.adherence !== null) parts.push(fmt(msgs.prep.adherence, { percent: `${Math.round(r.adherence * 100)}%` }));
      if (r.skipped) parts.push(f.plural(msgs.prep.skipped, r.skipped));
      lines.push(`• ${displayName(r.med)} — ${parts.join(' · ')}`);
    }
  }

  if (appt?.bring.trim()) lines.push('', `${msgs.prep.bring}:`, appt.bring.trim());
  lines.push('', `— ${msgs.share.generated}`);
  return lines.join('\n');
}

/** Follow-up presets in days. */
export const FOLLOW_UPS = [
  { key: 'weeks2', days: 14 },
  { key: 'month1', days: 28 },
  { key: 'months3', days: 91 },
  { key: 'months6', days: 182 },
] as const;

import type { Appointment, Medication } from '../types';
import type { Messages } from '../i18n/locales/en';
import type { Formatter } from '../i18n/format';
import { fmt } from '../i18n/format';
import { isCompleted, nextDue, remaining, sortTimes, startOfDay, tracksSupply } from './schedule';

const pad = (n: number) => String(n).padStart(2, '0');

const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

/** Floating local time: the event stays at e.g. 08:00 in whatever time zone the user is in (no DST drift). */
const localStamp = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** RFC 5545 line folding at 75 octets, without splitting multi-byte characters. */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    const limit = parts.length ? 74 : 75; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.map((p, i) => (i ? ` ${p}` : p)).join('\r\n');
}

type EventInput = { uid: string; start: string; rrule?: string; summary: string; description: string };

function vevent(e: EventInput, stamp: string): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${e.uid}@medtracker`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${e.start}`,
    'DURATION:PT15M',
    ...(e.rrule ? [`RRULE:${e.rrule}`] : []),
    `SUMMARY:${escapeText(e.summary)}`,
    `DESCRIPTION:${escapeText(e.description)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${escapeText(e.summary)}`,
    'END:VALARM',
    'END:VEVENT',
  ];
}

function eventsFor(m: Medication, msgs: Messages, f: Formatter, now: Date): EventInput[] {
  if (isCompleted(m) || m.schedule.type === 'asNeeded') return [];
  const label = m.strength ? `${m.name} ${m.strength}` : m.name;
  const summary = fmt(msgs.calendar.summary, { name: label });
  const instruction = m.instructions !== 'none' ? ` ${msgs.instructions[m.instructions]}.` : '';
  const description = fmt(msgs.calendar.description, { amount: f.amount(m.dosage, m.form) }) + instruction;
  const dosesLeft = tracksSupply(m) && m.dosage > 0 ? Math.ceil(remaining(m) / m.dosage) : null;

  if (m.schedule.type === 'interval') {
    const due = nextDue(m);
    if (!due) return [];
    const count = dosesLeft ? `;COUNT=${dosesLeft}` : '';
    return [
      {
        uid: `${m.id}-interval`,
        start: utcStamp(due),
        rrule: `FREQ=HOURLY;INTERVAL=${m.schedule.hours}${count}`,
        summary,
        description,
      },
    ];
  }

  const times = sortTimes(m.schedule.times);
  const today = startOfDay(now);
  return times.map((t, i) => {
    const [h, min] = t.split(':').map(Number);
    const dayOffset = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, min) <= now ? 1 : 0;
    const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, h, min);
    // Spread the remaining doses over the daily slots, earliest slots first.
    const count = dosesLeft ? Math.floor(dosesLeft / times.length) + (i < dosesLeft % times.length ? 1 : 0) : null;
    return {
      uid: `${m.id}-${t.replace(':', '')}`,
      start: localStamp(first),
      rrule: count === null ? 'FREQ=DAILY' : `FREQ=DAILY;COUNT=${Math.max(1, count)}`,
      summary,
      description,
    };
  });
}

/** Returns iCalendar text, or null when no medication has anything to schedule. */
export function buildICS(meds: Medication[], msgs: Messages, f: Formatter, now = new Date()): string | null {
  const stamp = utcStamp(now);
  const events = meds.flatMap((m) => eventsFor(m, msgs, f, now));
  if (!events.length) return null;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MedTracker//Medication reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(msgs.app.name)}`,
    ...events.flatMap((e) => vevent(e, stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** One appointment as an iCalendar event, with an alarm for each chosen reminder. */
export function buildAppointmentICS(
  appt: Appointment,
  msgs: Messages,
  description: string,
  now = new Date(),
): string {
  const start = new Date(appt.time);
  const alarms = (appt.reminders.length ? appt.reminders : [0]).flatMap((min) => [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:-PT${min}M`,
    `DESCRIPTION:${escapeText(fmt(msgs.notify.apptTitle, { doctor: appt.doctor }))}`,
    'END:VALARM',
  ]);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MedTracker//Appointments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${appt.id}-appt@medtracker`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    'DURATION:PT1H',
    `SUMMARY:${escapeText(fmt(msgs.calendar.apptSummary, { doctor: appt.clinic ? `${appt.doctor} (${appt.clinic})` : appt.doctor }))}`,
    ...(appt.location ? [`LOCATION:${escapeText(appt.location)}`] : []),
    `DESCRIPTION:${escapeText(description)}`,
    ...alarms,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

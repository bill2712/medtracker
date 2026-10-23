import type { DoseLog, Medication } from '../types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
/** A dose more than this late counts as overdue (rather than just due). */
export const OVERDUE_AFTER = HOUR;
/** Taking a dose this close to its due time does not ask for confirmation. */
export const EARLY_GRACE = 15 * MINUTE;

const round2 = (n: number) => Math.round(n * 100) / 100;
const ts = (iso: string) => Date.parse(iso);

export const startOfDay = (d: Date | number) => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
};
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const sortLogs = (logs: DoseLog[]) => [...logs].sort((a, b) => ts(a.time) - ts(b.time));
export const sortTimes = (times: string[]) => [...new Set(times)].sort();

export const lastLog = (m: Medication): DoseLog | null => (m.logs.length ? m.logs[m.logs.length - 1] : null);
export const lastTakenLog = (m: Medication): DoseLog | null => {
  for (let i = m.logs.length - 1; i >= 0; i--) if (!m.logs[i].skipped) return m.logs[i];
  return null;
};

export const takenAmount = (m: Medication) =>
  Math.max(0, round2(m.initialTaken + m.logs.reduce((sum, l) => (l.skipped ? sum : sum + l.amount), 0)));
export const tracksSupply = (m: Medication) => m.total > 0;
export const remaining = (m: Medication) => (tracksSupply(m) ? Math.max(0, round2(m.total - takenAmount(m))) : Infinity);
export const isCompleted = (m: Medication) => tracksSupply(m) && remaining(m) <= 0;
export const progress = (m: Medication) => (tracksSupply(m) ? Math.min(1, takenAmount(m) / m.total) : 0);

export function dosesPerDay(m: Medication): number {
  switch (m.schedule.type) {
    case 'interval':
      return 24 / m.schedule.hours;
    case 'times':
      return m.schedule.times.length;
    default:
      return 0;
  }
}

export function daysLeft(m: Medication): number | null {
  if (!tracksSupply(m)) return null;
  const perDay = dosesPerDay(m);
  if (!perDay || m.dosage <= 0) return null;
  return remaining(m) / (m.dosage * perDay);
}

export function isLowStock(m: Medication): boolean {
  if (!tracksSupply(m) || isCompleted(m)) return false;
  const days = daysLeft(m);
  if (days !== null) return days <= 3;
  return remaining(m) <= m.dosage * 3;
}

const slotOn = (day: Date, hhmm: string) => {
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min);
};

/** How early a dose can be taken and still count for a fixed-time slot. */
function slotWindow(times: string[]): number {
  const sorted = sortTimes(times);
  if (sorted.length < 2) return 2 * HOUR;
  const mins = sorted.map((t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  });
  let gap = 1440 - mins[mins.length - 1] + mins[0];
  for (let i = 1; i < mins.length; i++) gap = Math.min(gap, mins[i] - mins[i - 1]);
  return Math.min(2 * HOUR, (gap * MINUTE) / 2);
}

function firstSlotAfter(times: string[], anchor: number, window: number): Date | null {
  const sorted = sortTimes(times);
  if (!sorted.length) return null;
  const day = startOfDay(anchor);
  for (let i = 0; i <= 2; i++) {
    const d = addDays(day, i);
    for (const t of sorted) {
      const slot = slotOn(d, t);
      if (slot.getTime() - window > anchor) return slot;
    }
  }
  return null;
}

/**
 * When the next dose is due. For "as needed" medications this is the earliest
 * time the minimum gap allows another dose. `null` = no anchor yet.
 */
export function nextDue(m: Medication): Date | null {
  const s = m.schedule;
  if (s.type === 'interval') {
    const last = lastLog(m);
    return last ? new Date(ts(last.time) + s.hours * HOUR) : null;
  }
  if (s.type === 'asNeeded') {
    const last = lastTakenLog(m);
    return last ? new Date(ts(last.time) + s.minHours * HOUR) : null;
  }
  const last = lastLog(m);
  if (last) return firstSlotAfter(s.times, ts(last.time), slotWindow(s.times));
  return firstSlotAfter(s.times, ts(m.createdAt), 0);
}

export type MedStatus = 'completed' | 'notStarted' | 'due' | 'overdue' | 'upcoming' | 'prnReady' | 'prnWait';

export function getStatus(m: Medication, now: number): { status: MedStatus; due: Date | null } {
  if (isCompleted(m)) return { status: 'completed', due: null };
  const due = nextDue(m);
  if (m.schedule.type === 'asNeeded') {
    return { status: due && now < due.getTime() ? 'prnWait' : 'prnReady', due };
  }
  if (!due) return { status: 'notStarted', due: null };
  const diff = now - due.getTime();
  if (diff < 0) return { status: 'upcoming', due };
  if (diff > OVERDUE_AFTER) return { status: 'overdue', due };
  return { status: 'due', due };
}

/** Does taking a dose now deserve an "are you sure?" prompt? */
export function needsEarlyConfirm(m: Medication, now: number): Date | null {
  const { status, due } = getStatus(m, now);
  if (status === 'prnWait' && due) return due;
  if (status === 'upcoming' && due && due.getTime() - now > EARLY_GRACE) return due;
  return null;
}

const STATUS_ORDER: Record<MedStatus, number> = {
  overdue: 0,
  due: 1,
  notStarted: 2,
  upcoming: 3,
  prnReady: 4,
  prnWait: 5,
  completed: 6,
};

export function compareMeds(a: Medication, b: Medication, now: number): number {
  const sa = getStatus(a, now);
  const sb = getStatus(b, now);
  if (sa.status !== sb.status) return STATUS_ORDER[sa.status] - STATUS_ORDER[sb.status];
  const da = sa.due?.getTime() ?? Infinity;
  const db = sb.due?.getTime() ?? Infinity;
  if (da !== db) return da - db;
  return a.name.localeCompare(b.name);
}

/** First moment the schedule applies, for adherence maths. */
function scheduleStart(m: Medication): number | null {
  const first = m.logs[0] ? ts(m.logs[0].time) : null;
  if (m.schedule.type === 'interval') return first;
  const created = ts(m.createdAt);
  return first === null ? created : Math.min(created, first);
}

function scheduleEnd(m: Medication): number {
  if (!isCompleted(m)) return Infinity;
  const last = lastTakenLog(m);
  return last ? ts(last.time) : ts(m.createdAt);
}

/**
 * Number of doses scheduled on a calendar day. With `until`, only slots up to
 * that moment are counted (used for adherence so the rest of today is not "missed").
 */
export function expectedOnDay(m: Medication, day: Date, until = Infinity): number {
  const s = m.schedule;
  if (s.type === 'asNeeded') return 0;
  const start = scheduleStart(m);
  if (start === null) return 0;
  const dayStart = day.getTime();
  const dayEnd = addDays(day, 1).getTime();
  const end = Math.min(scheduleEnd(m), until);

  if (s.type === 'times') {
    const window = slotWindow(s.times);
    return sortTimes(s.times).filter((t) => {
      const slot = slotOn(day, t).getTime();
      return slot >= start - window && slot <= end + window;
    }).length;
  }

  const step = s.hours * HOUR;
  const lo = Math.max(dayStart, start);
  const hi = Math.min(dayEnd - 1, end);
  if (hi < lo) return 0;
  const kMin = Math.max(0, Math.ceil((lo - start) / step));
  const kMax = Math.floor((hi - start) / step);
  return Math.max(0, kMax - kMin + 1);
}

export function logsOnDay(m: Medication, day: Date): DoseLog[] {
  const a = day.getTime();
  const b = addDays(day, 1).getTime();
  return m.logs.filter((l) => {
    const t = ts(l.time);
    return t >= a && t < b;
  });
}

export type DaySummary = {
  day: Date;
  /** All doses taken, including "as needed" ones. */
  taken: number;
  /** Doses taken for scheduled (not "as needed") medications. */
  takenScheduled: number;
  skipped: number;
  /** Scheduled doses for the whole day. */
  expected: number;
  /** Scheduled doses up to now (adherence denominator). */
  expectedSoFar: number;
  /** Taken doses that count toward adherence (capped per medication). */
  onTrack: number;
};

export function summarizeDay(meds: Medication[], day: Date, now: number): DaySummary {
  const summary: DaySummary = { day, taken: 0, takenScheduled: 0, skipped: 0, expected: 0, expectedSoFar: 0, onTrack: 0 };
  const isToday = startOfDay(now).getTime() === day.getTime();
  for (const m of meds) {
    const logs = logsOnDay(m, day);
    const taken = logs.filter((l) => !l.skipped).length;
    summary.taken += taken;
    summary.skipped += logs.length - taken;
    let expected = expectedOnDay(m, day);
    if (isToday && tracksSupply(m) && m.dosage > 0) {
      expected = Math.min(expected, taken + Math.ceil(remaining(m) / m.dosage));
    }
    const soFar = Math.min(expected, expectedOnDay(m, day, now));
    summary.expected += expected;
    summary.expectedSoFar += soFar;
    if (m.schedule.type !== 'asNeeded') {
      summary.takenScheduled += taken;
      summary.onTrack += Math.min(taken, soFar);
    }
  }
  return summary;
}

export function summarizeRange(meds: Medication[], days: number, now: number): DaySummary[] {
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => summarizeDay(meds, addDays(today, i - days + 1), now));
}

/** 0..1, or null when nothing was scheduled. */
export function adherence(summaries: DaySummary[]): number | null {
  const expected = summaries.reduce((s, d) => s + d.expectedSoFar, 0);
  if (!expected) return null;
  return summaries.reduce((s, d) => s + d.onTrack, 0) / expected;
}

import {
  INSTRUCTIONS,
  MED_COLORS,
  MED_FORMS,
  NOTE_KINDS,
  REMINDER_OPTIONS,
  type Appointment,
  type DoctorNote,
  type DoseLog,
  type Medication,
  type Schedule,
  type Settings,
} from '../types';
import { sortLogs, sortTimes } from './schedule';
import { storage } from './safeStorage';

const MEDS_KEY = 'mt.v2.medications';
const SETTINGS_KEY = 'mt.settings';
const LEGACY_KEY = 'medications';
const APPTS_KEY = 'mt.v2.appointments';
const NOTES_KEY = 'mt.v2.notes';

export const DEFAULT_SETTINGS: Settings = { theme: 'system', notifications: false };

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const num = (v: unknown, fallback: number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;
const validIso = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

function normalizeSchedule(raw: any, legacyHours: unknown): Schedule {
  if (raw && typeof raw === 'object') {
    if (raw.type === 'times') {
      const times = Array.isArray(raw.times) ? sortTimes(raw.times.filter(isTime)) : [];
      if (times.length) return { type: 'times', times };
    }
    if (raw.type === 'asNeeded') return { type: 'asNeeded', minHours: Math.max(0, num(raw.minHours, 4)) };
    if (raw.type === 'interval') return { type: 'interval', hours: clampHours(num(raw.hours, 8)) };
  }
  return { type: 'interval', hours: clampHours(num(legacyHours, 8)) };
}

const clampHours = (h: number) => Math.min(168, Math.max(1, Math.round(h)));

/** Accepts current and legacy (v1) records; returns null for unusable input. */
export function normalizeMed(raw: any): Medication | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = str(raw.name).trim();
  if (!name) return null;
  const dosage = num(raw.dosage, 1) > 0 ? num(raw.dosage, 1) : 1;

  let logs: DoseLog[];
  if (Array.isArray(raw.logs)) {
    logs = raw.logs
      .filter((l: any) => l && validIso(l.time))
      .map((l: any) => ({
        id: str(l.id) || uid(),
        time: new Date(l.time).toISOString(),
        amount: num(l.amount, dosage),
        ...(l.skipped ? { skipped: true } : {}),
      }));
  } else {
    // v1: `history` is a list of ISO strings, `lastTakenTime` a single one.
    const history: unknown[] = Array.isArray(raw.history) ? raw.history : raw.lastTakenTime ? [raw.lastTakenTime] : [];
    logs = history.filter(validIso).map((t) => ({ id: uid(), time: new Date(t as string).toISOString(), amount: dosage }));
  }
  logs = sortLogs(logs);

  const loggedAmount = logs.reduce((s, l) => (l.skipped ? s : s + l.amount), 0);
  const initialTaken =
    'initialTaken' in raw ? num(raw.initialTaken, 0) : Math.max(0, num(raw.pillsTaken, 0) - loggedAmount);

  const createdAt = validIso(raw.createdAt)
    ? new Date(raw.createdAt).toISOString()
    : logs[0]?.time ?? new Date().toISOString();

  return {
    id: str(raw.id) || uid(),
    name,
    strength: str(raw.strength).trim(),
    form: oneOf(MED_FORMS, raw.form, 'tablet'),
    color: oneOf(MED_COLORS, raw.color, 'emerald'),
    dosage,
    total: Math.max(0, num(raw.total ?? raw.totalPills, 0)),
    initialTaken,
    schedule: normalizeSchedule(raw.schedule, raw.frequencyHours),
    instructions: oneOf(INSTRUCTIONS, raw.instructions, 'none'),
    notes: str(raw.notes),
    logs,
    createdAt,
  };
}

export function normalizeMeds(list: unknown): Medication[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: Medication[] = [];
  for (const raw of list) {
    const med = normalizeMed(raw);
    if (!med) continue;
    if (seen.has(med.id)) med.id = uid();
    seen.add(med.id);
    out.push(med);
  }
  return out;
}

export function loadMeds(): Medication[] {
  const current = storage.getJSON<unknown[]>(MEDS_KEY);
  if (current) return normalizeMeds(current);
  const legacy = storage.getJSON<unknown[]>(LEGACY_KEY);
  if (legacy) {
    const migrated = normalizeMeds(legacy);
    saveMeds(migrated);
    return migrated;
  }
  return [];
}

export function saveMeds(meds: Medication[]) {
  const json = JSON.stringify(meds);
  // Skipping identical writes avoids echo loops between open tabs.
  if (storage.get(MEDS_KEY) !== json) storage.set(MEDS_KEY, json);
}

export function loadSettings(): Settings {
  const raw = storage.getJSON<Partial<Settings>>(SETTINGS_KEY) ?? {};
  return {
    theme: oneOf(['system', 'light', 'dark'] as const, raw.theme, DEFAULT_SETTINGS.theme),
    notifications: raw.notifications === true,
  };
}

export const saveSettings = (s: Settings) => storage.setJSON(SETTINGS_KEY, s);

export function clearAll() {
  for (const key of [MEDS_KEY, SETTINGS_KEY, LEGACY_KEY, APPTS_KEY, NOTES_KEY, 'mt.notified']) storage.remove(key);
}

export function normalizeAppointment(raw: any): Appointment | null {
  if (!raw || typeof raw !== 'object' || !validIso(raw.time)) return null;
  const doctor = str(raw.doctor).trim();
  if (!doctor) return null;
  const reminders = Array.isArray(raw.reminders)
    ? [...new Set(raw.reminders.filter((r: unknown) => (REMINDER_OPTIONS as readonly unknown[]).includes(r)) as number[])]
    : [1440];
  return {
    id: str(raw.id) || uid(),
    doctor,
    clinic: str(raw.clinic).trim(),
    location: str(raw.location).trim(),
    time: new Date(raw.time).toISOString(),
    reminders: reminders.sort((a, b) => b - a),
    bring: str(raw.bring),
    outcome: str(raw.outcome),
    done: raw.done === true,
    createdAt: validIso(raw.createdAt) ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
  };
}

export function normalizeNote(raw: any): DoctorNote | null {
  if (!raw || typeof raw !== 'object') return null;
  const text = str(raw.text).trim();
  if (!text) return null;
  return {
    id: str(raw.id) || uid(),
    text,
    kind: oneOf(NOTE_KINDS, raw.kind, 'symptom'),
    ...(str(raw.medId) ? { medId: str(raw.medId) } : {}),
    createdAt: validIso(raw.createdAt) ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
    ...(raw.resolved === true ? { resolved: true } : {}),
    ...(str(raw.apptId) ? { apptId: str(raw.apptId) } : {}),
  };
}

const normalizeList = <T>(list: unknown, fn: (raw: unknown) => T | null): T[] =>
  Array.isArray(list) ? list.map(fn).filter((x): x is T => x !== null) : [];

export const normalizeAppointments = (list: unknown) =>
  normalizeList(list, normalizeAppointment).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
export const normalizeNotes = (list: unknown) => normalizeList(list, normalizeNote);

export const loadAppointments = () => normalizeAppointments(storage.getJSON(APPTS_KEY));
export const loadNotes = () => normalizeNotes(storage.getJSON(NOTES_KEY));
export const saveAppointments = (a: Appointment[]) => storage.setJSON(APPTS_KEY, a);
export const saveNotes = (n: DoctorNote[]) => storage.setJSON(NOTES_KEY, n);
export const STORAGE_KEYS = { meds: MEDS_KEY, appts: APPTS_KEY, notes: NOTES_KEY };

export type Backup = {
  app: 'MedTracker';
  version: 3;
  exportedAt: string;
  medications: Medication[];
  appointments: Appointment[];
  notes: DoctorNote[];
  settings: Settings;
};

export const createBackup = (
  medications: Medication[],
  appointments: Appointment[],
  notes: DoctorNote[],
  settings: Settings,
): Backup => ({
  app: 'MedTracker',
  version: 3,
  exportedAt: new Date().toISOString(),
  medications,
  appointments,
  notes,
  settings,
});

/** Accepts a backup object or a bare array (v1 data). Throws on invalid input. */
export function parseBackup(text: string): {
  medications: Medication[];
  appointments: Appointment[];
  notes: DoctorNote[];
  settings?: Settings;
} {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data?.medications;
  if (!Array.isArray(list)) throw new Error('invalid backup');
  const medications = normalizeMeds(list);
  if (list.length && !medications.length) throw new Error('invalid backup');
  const settings =
    data && !Array.isArray(data) && data.settings
      ? {
          theme: oneOf(['system', 'light', 'dark'] as const, data.settings.theme, 'system'),
          notifications: data.settings.notifications === true,
        }
      : undefined;
  const isObject = data && !Array.isArray(data);
  return {
    medications,
    appointments: isObject ? normalizeAppointments(data.appointments) : [],
    notes: isObject ? normalizeNotes(data.notes) : [],
    settings,
  };
}

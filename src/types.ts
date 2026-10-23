export const MED_FORMS = ['tablet', 'capsule', 'liquid', 'drops', 'inhaler', 'injection', 'patch', 'other'] as const;
export type MedForm = (typeof MED_FORMS)[number];

export const INSTRUCTIONS = ['none', 'withFood', 'beforeFood', 'afterFood', 'emptyStomach', 'bedtime'] as const;
export type Instruction = (typeof INSTRUCTIONS)[number];

export const MED_COLORS = ['emerald', 'sky', 'violet', 'rose', 'amber', 'orange', 'teal', 'slate'] as const;
export type MedColor = (typeof MED_COLORS)[number];

export type Schedule =
  | { type: 'interval'; hours: number }
  | { type: 'times'; times: string[] } // "HH:MM", local time
  | { type: 'asNeeded'; minHours: number };

export type DoseLog = {
  id: string;
  time: string; // ISO timestamp
  amount: number;
  skipped?: boolean;
};

export type Medication = {
  id: string;
  name: string;
  strength: string;
  form: MedForm;
  color: MedColor;
  dosage: number;
  /** Total quantity in the course / supply. 0 = do not track supply. */
  total: number;
  /** Quantity taken before logging started (or manual correction). */
  initialTaken: number;
  schedule: Schedule;
  instructions: Instruction;
  notes: string;
  logs: DoseLog[];
  createdAt: string;
};

export type Theme = 'system' | 'light' | 'dark';

export type Settings = {
  theme: Theme;
  notifications: boolean;
};

export type View = 'today' | 'visits' | 'history' | 'settings';

export const NOTE_KINDS = ['symptom', 'sideEffect', 'question', 'request'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/** Something to tell or ask the doctor at the next visit. */
export type DoctorNote = {
  id: string;
  text: string;
  kind: NoteKind;
  medId?: string;
  createdAt: string;
  /** Set once discussed; the note then belongs to that visit. */
  resolved?: boolean;
  apptId?: string;
};

/** Minutes before the appointment. */
export const REMINDER_OPTIONS = [10080, 1440, 120, 0] as const;

export type Appointment = {
  id: string;
  doctor: string;
  clinic: string;
  location: string;
  time: string; // ISO timestamp
  reminders: number[];
  bring: string;
  outcome: string;
  done: boolean;
  createdAt: string;
};

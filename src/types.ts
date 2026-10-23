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

export type View = 'today' | 'history' | 'settings';

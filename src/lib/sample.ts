import type { Medication } from '../types';
import type { Messages } from '../i18n/locales/en';
import { HOUR } from './schedule';
import { uid } from './storage';

export function sampleMeds(m: Messages, now = Date.now()): Medication[] {
  const iso = (t: number) => new Date(t).toISOString();
  const created = iso(now - 6 * HOUR - 60_000);
  return [
    {
      id: uid(),
      name: m.sample.antibiotic,
      strength: '500 mg',
      form: 'capsule',
      color: 'sky',
      dosage: 1,
      total: 21,
      initialTaken: 0,
      schedule: { type: 'interval', hours: 8 },
      instructions: 'afterFood',
      notes: '',
      logs: [{ id: uid(), time: iso(now - 6 * HOUR), amount: 1 }],
      createdAt: created,
    },
    {
      id: uid(),
      name: m.sample.allergy,
      strength: '180 mg',
      form: 'tablet',
      color: 'violet',
      dosage: 1,
      total: 10,
      initialTaken: 0,
      schedule: { type: 'times', times: ['09:00'] },
      instructions: 'none',
      notes: '',
      logs: [],
      createdAt: iso(now),
    },
    {
      id: uid(),
      name: m.sample.painkiller,
      strength: '200 mg',
      form: 'tablet',
      color: 'rose',
      dosage: 2,
      total: 20,
      initialTaken: 0,
      schedule: { type: 'asNeeded', minHours: 6 },
      instructions: 'withFood',
      notes: '',
      logs: [{ id: uid(), time: iso(now - 3 * HOUR), amount: 2 }],
      createdAt: created,
    },
    {
      id: uid(),
      name: m.sample.vitamin,
      strength: '1000 IU',
      form: 'capsule',
      color: 'amber',
      dosage: 1,
      total: 0,
      initialTaken: 0,
      schedule: { type: 'times', times: ['08:00'] },
      instructions: 'withFood',
      notes: '',
      logs: [],
      createdAt: iso(now),
    },
  ];
}

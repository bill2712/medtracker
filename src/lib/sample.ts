import type { Appointment, DoctorNote, Medication } from '../types';
import type { Messages } from '../i18n/locales/en';
import { DAY, HOUR } from './schedule';
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

/** A follow-up in 5 days, a past visit and a few notes, linked to the sample medications. */
export function sampleVisits(m: Messages, meds: Medication[], now = Date.now()): { appointments: Appointment[]; notes: DoctorNote[] } {
  const iso = (t: number) => new Date(t).toISOString();
  const next = new Date(now + 5 * DAY);
  next.setHours(10, 30, 0, 0);
  const last = new Date(now - 26 * DAY);
  last.setHours(15, 0, 0, 0);
  const base = { doctor: m.sample.doctor, clinic: m.sample.clinic, location: m.sample.location };
  const lastId = uid();
  const antibiotic = meds.find((x) => x.name === m.sample.antibiotic);
  const painkiller = meds.find((x) => x.name === m.sample.painkiller);
  return {
    appointments: [
      { id: lastId, ...base, time: iso(last.getTime()), reminders: [1440], bring: '', outcome: '', done: true, createdAt: iso(now - 40 * DAY) },
      { id: uid(), ...base, time: iso(next.getTime()), reminders: [1440, 120], bring: m.sample.bring, outcome: '', done: false, createdAt: iso(now) },
    ],
    notes: [
      { id: uid(), text: m.sample.noteSymptom, kind: 'sideEffect', ...(antibiotic ? { medId: antibiotic.id } : {}), createdAt: iso(now - 2 * DAY) },
      { id: uid(), text: m.sample.noteQuestion, kind: 'question', ...(painkiller ? { medId: painkiller.id } : {}), createdAt: iso(now - DAY) },
      { id: uid(), text: m.sample.noteRequest, kind: 'request', createdAt: iso(now - 3 * HOUR) },
    ],
  };
}

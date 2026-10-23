import { useEffect, useId, useState, type FormEvent } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { REMINDER_OPTIONS, type Appointment } from '../types';
import { useI18n } from '../i18n';
import { uid } from '../lib/storage';
import { buttonClass, cx, Field, inputClass, Modal } from './ui';

type Draft = {
  doctor: string;
  clinic: string;
  location: string;
  date: string; // YYYY-MM-DD (local)
  time: string; // HH:MM (local)
  reminders: number[];
  bring: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function toDraft(appt: Appointment | null, preset?: Partial<Appointment>): Draft {
  const src = appt ?? preset;
  let when: Date;
  if (src?.time) when = new Date(src.time);
  else {
    when = new Date();
    when.setDate(when.getDate() + 7);
    when.setHours(9, 30, 0, 0);
  }
  return {
    doctor: src?.doctor ?? '',
    clinic: src?.clinic ?? '',
    location: src?.location ?? '',
    date: toDate(when),
    time: toTime(when),
    reminders: src?.reminders ?? [1440, 120],
    bring: src?.bring ?? '',
  };
}

export function AppointmentForm({
  open,
  appt,
  preset,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  appt: Appointment | null;
  /** Prefill for a new appointment, e.g. the next follow-up with the same doctor. */
  preset?: Partial<Appointment>;
  onSave: (a: Appointment) => void;
  onDelete: (a: Appointment) => void;
  onClose: () => void;
}) {
  const { m } = useI18n();
  const ids = useId();
  const id = (k: string) => `${ids}-${k}`;
  const [draft, setDraft] = useState<Draft>(() => toDraft(appt, preset));
  const [errors, setErrors] = useState<{ doctor?: string; date?: string }>({});

  useEffect(() => {
    if (open) {
      setDraft(toDraft(appt, preset));
      setErrors({});
    }
  }, [open, appt, preset]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const when = new Date(`${draft.date}T${draft.time || '09:00'}`);
    const errs: typeof errors = {};
    if (!draft.doctor.trim()) errs.doctor = m.appt.errorDoctor;
    if (!draft.date || Number.isNaN(when.getTime())) errs.date = m.appt.errorDate;
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[role=dialog] [aria-invalid="true"]')?.focus());
      return;
    }
    onSave({
      id: appt?.id ?? uid(),
      doctor: draft.doctor.trim(),
      clinic: draft.clinic.trim(),
      location: draft.location.trim(),
      time: when.toISOString(),
      reminders: [...draft.reminders].sort((a, b) => b - a),
      bring: draft.bring.trim(),
      outcome: appt?.outcome ?? '',
      done: appt?.done ?? false,
      createdAt: appt?.createdAt ?? new Date().toISOString(),
    });
  };

  const remindLabel = (min: (typeof REMINDER_OPTIONS)[number]) => m.appt[`remind${min}` as const];

  return (
    <Modal
      open={open}
      title={appt ? m.appt.edit : m.appt.add}
      onClose={onClose}
      footer={
        <>
          {appt && (
            <button type="button" onClick={() => onDelete(appt)} className={buttonClass('dangerGhost', 'mr-auto')}>
              <Trash2 size={16} aria-hidden="true" /> {m.form.delete}
            </button>
          )}
          <button type="button" onClick={onClose} className={buttonClass('secondary')}>
            {m.form.cancel}
          </button>
          <button type="submit" form={id('form')} className={buttonClass('primary')}>
            <Check size={18} aria-hidden="true" /> {m.form.save}
          </button>
        </>
      }
    >
      <form id={id('form')} onSubmit={submit} noValidate className="space-y-5">
        <Field id={id('doctor')} label={m.appt.doctor} error={errors.doctor}>
          <input
            id={id('doctor')}
            data-autofocus={!appt || undefined}
            className={inputClass}
            value={draft.doctor}
            onChange={(e) => set('doctor', e.target.value)}
            placeholder={m.appt.doctorPlaceholder}
            autoComplete="off"
            aria-invalid={!!errors.doctor}
          />
        </Field>
        <Field id={id('clinic')} label={m.appt.clinic} optional={m.form.optional}>
          <input
            id={id('clinic')}
            className={inputClass}
            value={draft.clinic}
            onChange={(e) => set('clinic', e.target.value)}
            placeholder={m.appt.clinicPlaceholder}
            autoComplete="off"
          />
        </Field>
        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <Field id={id('date')} label={m.appt.date} error={errors.date}>
            <input
              id={id('date')}
              type="date"
              className={inputClass}
              value={draft.date}
              onChange={(e) => set('date', e.target.value)}
              aria-invalid={!!errors.date}
            />
          </Field>
          <Field id={id('time')} label={m.appt.time}>
            <input id={id('time')} type="time" className={inputClass} value={draft.time} onChange={(e) => set('time', e.target.value)} />
          </Field>
        </div>
        <Field id={id('location')} label={m.appt.location} optional={m.form.optional}>
          <input
            id={id('location')}
            className={inputClass}
            value={draft.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder={m.appt.locationPlaceholder}
            autoComplete="off"
          />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{m.appt.remind}</legend>
          <div className="flex flex-wrap gap-2">
            {REMINDER_OPTIONS.map((min) => {
              const on = draft.reminders.includes(min);
              return (
                <button
                  key={min}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('reminders', on ? draft.reminders.filter((r) => r !== min) : [...draft.reminders, min])}
                  className={cx(
                    'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                    on
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {on && <Check size={14} aria-hidden="true" />}
                  {remindLabel(min)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field id={id('bring')} label={m.appt.bring} optional={m.form.optional}>
          <textarea
            id={id('bring')}
            className={cx(inputClass, 'min-h-20 resize-y')}
            rows={2}
            value={draft.bring}
            onChange={(e) => set('bring', e.target.value)}
            placeholder={m.appt.bringPlaceholder}
          />
        </Field>
      </form>
    </Modal>
  );
}

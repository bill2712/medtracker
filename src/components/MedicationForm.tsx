import { useEffect, useId, useState, type FormEvent } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { INSTRUCTIONS, MED_COLORS, MED_FORMS, type Instruction, type MedColor, type MedForm, type Medication } from '../types';
import { useI18n } from '../i18n';
import { sortTimes, takenAmount } from '../lib/schedule';
import { uid } from '../lib/storage';
import { buttonClass, COLOR, cx, Field, FORM_ICON, inputClass, Modal, Segmented } from './ui';

type ScheduleType = Medication['schedule']['type'];

type Draft = {
  name: string;
  strength: string;
  form: MedForm;
  color: MedColor;
  dosage: string;
  scheduleType: ScheduleType;
  hours: string;
  times: string[];
  minHours: string;
  total: string;
  taken: string;
  instructions: Instruction;
  notes: string;
};

const HOUR_PRESETS = [4, 6, 8, 12, 24];
const TIME_PRESETS: string[][] = [['08:00'], ['08:00', '20:00'], ['08:00', '14:00', '20:00'], ['08:00', '12:00', '16:00', '20:00']];

function toDraft(med: Medication | null, color: MedColor): Draft {
  const s = med?.schedule;
  return {
    name: med?.name ?? '',
    strength: med?.strength ?? '',
    form: med?.form ?? 'tablet',
    color: med?.color ?? color,
    dosage: String(med?.dosage ?? 1),
    scheduleType: s?.type ?? 'times',
    hours: String(s?.type === 'interval' ? s.hours : 8),
    times: s?.type === 'times' ? s.times : ['08:00', '20:00'],
    minHours: String(s?.type === 'asNeeded' ? s.minHours : 6),
    total: String(med?.total ?? 0),
    taken: String(med ? takenAmount(med) : 0),
    instructions: med?.instructions ?? 'none',
    notes: med?.notes ?? '',
  };
}

const toNum = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

function nextTime(times: string[]): string {
  if (!times.length) return '08:00';
  const [h, m] = sortTimes(times)[times.length - 1].split(':').map(Number);
  const nh = Math.min(23, h + 4);
  return `${String(nh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function MedicationForm({
  open,
  med,
  defaultColor,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  med: Medication | null;
  defaultColor: MedColor;
  onSave: (m: Medication, isNew: boolean) => void;
  onDelete: (m: Medication) => void;
  onClose: () => void;
}) {
  const { m, f, t } = useI18n();
  const [draft, setDraft] = useState<Draft>(() => toDraft(med, defaultColor));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const ids = useId();
  const id = (k: string) => `${ids}-${k}`;

  useEffect(() => {
    if (open) {
      setDraft(toDraft(med, defaultColor));
      setErrors({});
    }
  }, [open, med, defaultColor]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const validate = () => {
    const e: Partial<Record<keyof Draft, string>> = {};
    if (!draft.name.trim()) e.name = m.form.errors.name;
    const dosage = toNum(draft.dosage);
    if (!(dosage > 0)) e.dosage = m.form.errors.dosage;
    const hours = toNum(draft.hours);
    if (draft.scheduleType === 'interval' && !(Number.isInteger(hours) && hours >= 1 && hours <= 168)) e.hours = m.form.errors.hours;
    const minHours = toNum(draft.minHours);
    if (draft.scheduleType === 'asNeeded' && !(Number.isInteger(minHours) && minHours >= 1 && minHours <= 168))
      e.minHours = m.form.errors.hours;
    if (draft.scheduleType === 'times' && !draft.times.filter(Boolean).length) e.times = m.form.errors.times;
    const total = toNum(draft.total || '0');
    if (!(total >= 0)) e.total = m.form.errors.total;
    const taken = toNum(draft.taken || '0');
    if (!(taken >= 0)) e.taken = m.form.errors.total;
    else if (total > 0 && taken > total) e.taken = m.form.errors.taken;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const logs = med?.logs ?? [];
    const logged = logs.reduce((s, l) => (l.skipped ? s : s + l.amount), 0);
    const schedule: Medication['schedule'] =
      draft.scheduleType === 'interval'
        ? { type: 'interval', hours: toNum(draft.hours) }
        : draft.scheduleType === 'times'
          ? { type: 'times', times: sortTimes(draft.times.filter(Boolean)) }
          : { type: 'asNeeded', minHours: toNum(draft.minHours) };
    const result: Medication = {
      id: med?.id ?? uid(),
      name: draft.name.trim(),
      strength: draft.strength.trim(),
      form: draft.form,
      color: draft.color,
      dosage: toNum(draft.dosage),
      total: toNum(draft.total || '0'),
      initialTaken: Math.round((toNum(draft.taken || '0') - logged) * 100) / 100,
      schedule,
      instructions: draft.instructions,
      notes: draft.notes.trim(),
      logs,
      createdAt: med?.createdAt ?? new Date().toISOString(),
    };
    onSave(result, !med);
  };

  const err = (k: keyof Draft) =>
    errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `${id(k)}-error` } : { 'aria-invalid': false as const };

  const unit = f.plural(m.units[draft.form], 2);

  return (
    <Modal
      open={open}
      title={med ? m.form.editTitle : m.form.addTitle}
      onClose={onClose}
      footer={
        <>
          {med && (
            <button type="button" onClick={() => onDelete(med)} className={buttonClass('dangerGhost', 'mr-auto')}>
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
        <div className="grid grid-cols-[1fr_9rem] items-end gap-3">
          <Field id={id('name')} label={m.form.name} error={errors.name}>
            <input
              id={id('name')}
              data-autofocus={!med || undefined}
              className={inputClass}
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={m.form.namePlaceholder}
              autoComplete="off"
              enterKeyHint="next"
              {...err('name')}
            />
          </Field>
          <Field id={id('strength')} label={m.form.strength} optional={m.form.optional}>
            <input
              id={id('strength')}
              className={inputClass}
              value={draft.strength}
              onChange={(e) => set('strength', e.target.value)}
              placeholder={m.form.strengthPlaceholder}
              autoComplete="off"
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{m.form.form}</legend>
          <div className="grid grid-cols-4 gap-2" role="radiogroup">
            {MED_FORMS.map((form) => {
              const Icon = FORM_ICON[form];
              const active = draft.form === form;
              return (
                <button
                  key={form}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set('form', form)}
                  className={cx(
                    'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                    active
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400',
                  )}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span className="line-clamp-1">{m.forms[form]}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{m.form.color}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {MED_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={draft.color === c}
                aria-label={t(m.a11y.selectColor, { color: m.colors[c] })}
                title={m.colors[c]}
                onClick={() => set('color', c)}
                className={cx(
                  'flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform sm:h-9 sm:w-9',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                  COLOR[c].dot,
                  draft.color === c ? 'scale-110 ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-slate-900' : 'hover:scale-105',
                )}
              >
                {draft.color === c && <Check size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </fieldset>

        <Field id={id('dosage')} label={`${m.form.dosage} (${unit})`} error={errors.dosage}>
          <input
            id={id('dosage')}
            className={inputClass}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft.dosage}
            onChange={(e) => set('dosage', e.target.value)}
            {...err('dosage')}
          />
        </Field>

        <fieldset className="space-y-3">
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{m.form.schedule}</legend>
          <Segmented
            label={m.form.schedule}
            value={draft.scheduleType}
            onChange={(v) => set('scheduleType', v)}
            options={[
              { value: 'times', label: m.form.times },
              { value: 'interval', label: m.form.interval },
              { value: 'asNeeded', label: m.form.asNeeded },
            ]}
          />

          {draft.scheduleType === 'interval' && (
            <Field id={id('hours')} label={m.form.intervalHours} error={errors.hours}>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={id('hours')}
                  className={cx(inputClass, 'w-24')}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={168}
                  value={draft.hours}
                  onChange={(e) => set('hours', e.target.value)}
                  {...err('hours')}
                />
                {HOUR_PRESETS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => set('hours', String(h))}
                    aria-pressed={draft.hours === String(h)}
                    className={cx(
                      'min-h-10 rounded-full px-3 text-sm font-medium transition-colors',
                      draft.hours === String(h)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                    )}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </Field>
          )}

          {draft.scheduleType === 'times' && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">{m.form.doseTimes}</span>
                <div className="flex gap-1">
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.length}
                      type="button"
                      onClick={() => set('times', preset)}
                      aria-label={`${preset.length}× · ${f.list(preset.map(f.clock))}`}
                      className="min-h-9 rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {preset.length}×
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-2">
                {draft.times.map((time, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${m.form.doseTimes} ${i + 1}`}
                      className={inputClass}
                      value={time}
                      onChange={(e) => set('times', draft.times.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    <button
                      type="button"
                      onClick={() => set('times', draft.times.filter((_, j) => j !== i))}
                      aria-label={m.form.removeTime}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    >
                      <X size={18} />
                    </button>
                  </li>
                ))}
              </ul>
              {errors.times && <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{errors.times}</p>}
              {draft.times.length < 8 && (
                <button
                  type="button"
                  onClick={() => set('times', [...draft.times, nextTime(draft.times)])}
                  className={buttonClass('ghost', 'mt-2 w-full border-2 border-dashed border-slate-200 dark:border-slate-700')}
                >
                  <Plus size={16} aria-hidden="true" /> {m.form.addTime}
                </button>
              )}
            </div>
          )}

          {draft.scheduleType === 'asNeeded' && (
            <Field id={id('minHours')} label={m.form.minHours} error={errors.minHours}>
              <input
                id={id('minHours')}
                className={cx(inputClass, 'w-24')}
                type="number"
                inputMode="numeric"
                min={1}
                max={168}
                value={draft.minHours}
                onChange={(e) => set('minHours', e.target.value)}
                {...err('minHours')}
              />
            </Field>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{m.form.supply}</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field id={id('total')} label={`${m.form.total} (${unit})`} hint={m.form.totalHint} error={errors.total}>
              <input
                id={id('total')}
                className={inputClass}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={draft.total}
                onChange={(e) => set('total', e.target.value)}
                aria-describedby={`${id('total')}-hint`}
                {...err('total')}
              />
            </Field>
            <Field id={id('taken')} label={`${m.form.taken} (${unit})`} error={errors.taken}>
              <input
                id={id('taken')}
                className={inputClass}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={draft.taken}
                onChange={(e) => set('taken', e.target.value)}
                {...err('taken')}
              />
            </Field>
          </div>
        </fieldset>

        <Field id={id('instructions')} label={m.form.instructions}>
          <select
            id={id('instructions')}
            className={inputClass}
            value={draft.instructions}
            onChange={(e) => set('instructions', e.target.value as Instruction)}
          >
            {INSTRUCTIONS.map((i) => (
              <option key={i} value={i}>
                {m.instructions[i]}
              </option>
            ))}
          </select>
        </Field>

        <Field id={id('notes')} label={m.form.notes} optional={m.form.optional}>
          <textarea
            id={id('notes')}
            className={cx(inputClass, 'min-h-20 resize-y')}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder={m.form.notesPlaceholder}
            rows={2}
          />
        </Field>
      </form>
    </Modal>
  );
}

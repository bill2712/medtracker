import { useId, useState, type FormEvent } from 'react';
import { CalendarClock, ChevronRight, MapPin, MessageSquarePlus, NotebookPen, Stethoscope, Trash2 } from 'lucide-react';
import { NOTE_KINDS, type Appointment, type DoctorNote, type Medication, type NoteKind } from '../types';
import { useI18n } from '../i18n';
import { uid } from '../lib/storage';
import { displayName } from '../lib/describe';
import { isHappening } from '../lib/visits';
import { buttonClass, cx, inputClass } from './ui';

export const KIND_STYLE: Record<NoteKind, string> = {
  symptom: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
  sideEffect: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  question: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
  request: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
};

/** Quick form for a note to the doctor: text, type and an optional medication. */
export function NoteComposer({ meds, onAdd, autoFocus }: { meds: Medication[]; onAdd: (n: DoctorNote) => void; autoFocus?: boolean }) {
  const { m } = useI18n();
  const id = useId();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<NoteKind>('symptom');
  const [medId, setMedId] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd({ id: uid(), text: text.trim(), kind, ...(medId ? { medId } : {}), createdAt: new Date().toISOString() });
    setText('');
    setMedId('');
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor={`${id}-text`} className="sr-only">
        {m.notes.title}
      </label>
      <textarea
        id={`${id}-text`}
        className={cx(inputClass, 'min-h-20 resize-y')}
        rows={2}
        value={text}
        placeholder={m.notes.placeholder}
        onChange={(e) => setText(e.target.value)}
        data-autofocus={autoFocus || undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
        }}
      />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={m.notes.kind}>
        {NOTE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cx(
              'min-h-9 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
              kind === k ? KIND_STYLE[k] + ' ring-1 ring-current' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            {m.notes[k]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {meds.length > 0 && (
          <div className="min-w-0 grow">
            <label htmlFor={`${id}-med`} className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {m.notes.relatedMed}
            </label>
            <select id={`${id}-med`} className={cx(inputClass, 'py-2 text-sm')} value={medId} onChange={(e) => setMedId(e.target.value)}>
              <option value="">{m.notes.noMed}</option>
              {meds.map((med) => (
                <option key={med.id} value={med.id}>
                  {displayName(med)}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" disabled={!text.trim()} className={buttonClass('primary', 'shrink-0')}>
          <MessageSquarePlus size={18} aria-hidden="true" /> {m.notes.add}
        </button>
      </div>
    </form>
  );
}

export function NoteRow({
  note,
  meds,
  onToggle,
  onRemove,
}: {
  note: DoctorNote;
  meds: Medication[];
  onToggle?: (discussed: boolean) => void;
  onRemove?: () => void;
}) {
  const { m, f } = useI18n();
  const med = meds.find((x) => x.id === note.medId);
  const checkId = `note-${note.id}`;
  return (
    <li className="flex items-start gap-3 py-3">
      {onToggle && (
        <input
          id={checkId}
          type="checkbox"
          checked={!!note.resolved}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={m.notes.discussed}
          className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded accent-emerald-600"
        />
      )}
      <div className="min-w-0 grow">
        <p className={cx('whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-200', note.resolved && 'text-slate-400 line-through dark:text-slate-500')}>
          {note.text}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className={cx('rounded-full px-2 py-0.5 font-semibold', KIND_STYLE[note.kind])}>{m.notes[note.kind]}</span>
          {med && <span className="font-medium">{displayName(med)}</span>}
          <span>{f.date(new Date(note.createdAt))}</span>
          {note.resolved && <span className="font-semibold text-emerald-700 dark:text-emerald-400">✓ {m.notes.discussed}</span>}
        </p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={m.notes.remove}
          title={m.notes.remove}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
        >
          <Trash2 size={16} />
        </button>
      )}
    </li>
  );
}

/** Compact appointment summary used on the Today dashboard and the Visits list. */
export function AppointmentSummary({
  appt,
  now,
  notesCount,
  onOpen,
  emphasis,
}: {
  appt: Appointment;
  now: number;
  notesCount: number;
  onOpen: () => void;
  emphasis?: boolean;
}) {
  const { m, f } = useI18n();
  const when = new Date(appt.time);
  const happening = isHappening(appt, now);
  const soon = !happening && when.getTime() - now < 86_400_000;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        'group flex w-full items-center gap-4 rounded-3xl p-4 text-left shadow-sm ring-1 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
        emphasis
          ? 'bg-gradient-to-br from-sky-50 to-white ring-sky-200 dark:from-sky-500/10 dark:to-slate-900 dark:ring-sky-500/30'
          : 'bg-white ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800',
      )}
    >
      <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
        <span className="text-[10px] font-semibold uppercase leading-none tracking-wide opacity-90">{f.weekday(when)}</span>
        <span className="text-xl font-bold leading-tight tabular-nums">{when.getDate()}</span>
      </span>
      <span className="min-w-0 grow">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          <Stethoscope size={14} aria-hidden="true" /> {emphasis ? m.dashboard.nextAppt : f.date(when)}
        </span>
        <span className="block truncate text-base font-semibold text-slate-900 dark:text-white">
          {appt.doctor}
          {appt.clinic && <span className="font-normal text-slate-500 dark:text-slate-400"> · {appt.clinic}</span>}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-600 dark:text-slate-300">
          <span className={cx('inline-flex items-center gap-1', (soon || happening) && 'font-semibold text-sky-700 dark:text-sky-300')}>
            <CalendarClock size={14} aria-hidden="true" />
            {happening ? m.appt.now : `${f.relativeDateTime(when, new Date(now))} · ${f.until(when.getTime() - now, m.appt.inDuration)}`}
          </span>
          {appt.location && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin size={14} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{appt.location}</span>
            </span>
          )}
        </span>
        {notesCount > 0 && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
            <NotebookPen size={12} aria-hidden="true" /> {f.plural(m.appt.notesCount, notesCount)}
          </span>
        )}
      </span>
      <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

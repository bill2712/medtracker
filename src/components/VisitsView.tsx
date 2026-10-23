import { CalendarPlus, ChevronDown, CircleCheck, NotebookPen, Plus, Stethoscope, TriangleAlert } from 'lucide-react';
import type { Appointment, DoctorNote, Medication } from '../types';
import { useI18n } from '../i18n';
import { openNotes, pastAppointments, upcomingAppointments } from '../lib/visits';
import { buttonClass, cx } from './ui';
import { AppointmentSummary, NoteComposer, NoteRow } from './VisitParts';

export function VisitsView({
  now,
  meds,
  appointments,
  notes,
  onAdd,
  onOpen,
  onAddNote,
  onRemoveNote,
}: {
  now: number;
  meds: Medication[];
  appointments: Appointment[];
  notes: DoctorNote[];
  onAdd: () => void;
  onOpen: (a: Appointment) => void;
  onAddNote: (n: DoctorNote) => void;
  onRemoveNote: (n: DoctorNote) => void;
}) {
  const { m, f } = useI18n();
  const upcoming = upcomingAppointments(appointments, now);
  const past = pastAppointments(appointments, now);
  const open = openNotes(notes);
  const [next, ...later] = upcoming;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{m.appt.title}</h1>
        <button type="button" onClick={onAdd} className={buttonClass('primary')}>
          <Plus size={18} aria-hidden="true" /> {m.appt.add}
        </button>
      </div>

      {next ? (
        <AppointmentSummary appt={next} now={now} notesCount={open.length} onOpen={() => onOpen(next)} emphasis />
      ) : (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-slate-200 px-6 py-8 text-center dark:border-slate-800">
          <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            <Stethoscope size={28} aria-hidden="true" />
          </span>
          <p className="font-semibold text-slate-900 dark:text-white">{m.appt.none}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">{m.appt.noneHint}</p>
          <button type="button" onClick={onAdd} className={buttonClass('soft', 'mt-4')}>
            <CalendarPlus size={18} aria-hidden="true" /> {m.appt.add}
          </button>
        </div>
      )}

      {later.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{m.appt.upcoming}</h2>
          <div className="space-y-3">
            {later.map((a) => (
              <AppointmentSummary key={a.id} appt={a} now={now} notesCount={0} onOpen={() => onOpen(a)} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="notes-title" className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
        <h2 id="notes-title" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <NotebookPen size={20} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
          {m.notes.title}
          {open.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs tabular-nums text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">{open.length}</span>
          )}
        </h2>
        <p className="mb-4 mt-1 text-sm text-slate-500 dark:text-slate-400">{m.notes.hint}</p>
        <NoteComposer meds={meds} onAdd={onAddNote} />
        {open.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {open.map((n) => (
              <NoteRow key={n.id} note={n} meds={meds} onRemove={() => onRemoveNote(n)} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{m.notes.empty}</p>
        )}
      </section>

      {past.length > 0 && (
        <details className="group mt-8" open={past.some((a) => !a.done)}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
            {m.appt.past}
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">{past.length}</span>
            <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
            {past.map((a) => {
              const when = new Date(a.time);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(a)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800/60"
                  >
                    <span
                      className={cx(
                        'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                        a.done
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
                      )}
                    >
                      {a.done ? <CircleCheck size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 grow">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {a.doctor}
                        {a.clinic && <span className="font-normal text-slate-500 dark:text-slate-400"> · {a.clinic}</span>}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {f.longDate(when)} {f.time(when)}
                        {a.done && ` · ${m.appt.done}`}
                      </span>
                      {a.done && a.outcome.trim() ? (
                        <span className="mt-1 line-clamp-2 block text-sm text-slate-600 dark:text-slate-300">{a.outcome}</span>
                      ) : !a.done ? (
                        <span className="mt-1 block text-sm text-amber-800 dark:text-amber-200">{m.appt.pending}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

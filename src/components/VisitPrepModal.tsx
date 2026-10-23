import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Backpack, CalendarPlus, CircleCheck, MapPin, Pencil, Share2, Sparkles } from 'lucide-react';
import type { Appointment, DoctorNote, Medication } from '../types';
import { useI18n } from '../i18n';
import { isLowStock } from '../lib/schedule';
import { displayName, scheduleText } from '../lib/describe';
import { FOLLOW_UPS, medsToReview, notesForVisit, reviewMed, reviewStart, suggestions, visitSummaryText } from '../lib/visits';
import { buttonClass, cx, inputClass, MedIcon, Modal } from './ui';
import { NoteComposer, NoteRow } from './VisitParts';

export type CompleteVisit = (appt: Appointment, outcome: string, followUpDays: number | null) => void;

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-5 first:border-0 first:pt-0 dark:border-slate-800">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function VisitPrepModal({
  appt,
  now,
  meds,
  notes,
  appointments,
  onAddNote,
  onToggleNote,
  onRemoveNote,
  onShare,
  onCalendar,
  onEdit,
  onComplete,
  onSaveOutcome,
  onClose,
}: {
  appt: Appointment | null;
  now: number;
  meds: Medication[];
  notes: DoctorNote[];
  appointments: Appointment[];
  onAddNote: (n: DoctorNote) => void;
  onToggleNote: (noteId: string, apptId: string, discussed: boolean) => void;
  onRemoveNote: (n: DoctorNote) => void;
  onShare: (text: string) => void;
  onCalendar: (a: Appointment, description: string) => void;
  onEdit: (a: Appointment) => void;
  onComplete: CompleteVisit;
  onSaveOutcome: (a: Appointment, outcome: string) => void;
  onClose: () => void;
}) {
  const { m, f, t } = useI18n();
  const id = useId();
  const [finishing, setFinishing] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [followUp, setFollowUp] = useState<number | null>(null);

  useEffect(() => {
    if (appt) {
      setFinishing(false);
      setOutcome(appt.outcome);
      setFollowUp(null);
    }
  }, [appt?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Review since the last attended visit before this one.
  const from = useMemo(
    () => reviewStart(appointments.filter((a) => a.id !== appt?.id && (!appt || Date.parse(a.time) < Date.parse(appt.time))), now),
    [appointments, appt, now],
  );
  const reviews = useMemo(() => medsToReview(meds, from).map((med) => reviewMed(med, from, now)), [meds, from, now]);
  const visitNotes = appt?.done ? notes.filter((n) => n.apptId === appt.id) : notesForVisit(notes, appt);
  const tips = appt?.done ? [] : suggestions(reviews, m, from);
  const summary = () => visitSummaryText(appt, visitNotes, reviews, from, meds, m, f);

  if (!appt) return <Modal open={false} title="" onClose={onClose}>{null}</Modal>;
  const when = new Date(appt.time);

  const footer = appt.done ? (
    <>
      <button type="button" onClick={onClose} className={buttonClass('secondary')}>
        {m.form.cancel}
      </button>
      <button type="button" onClick={() => onSaveOutcome(appt, outcome)} className={buttonClass('primary')}>
        {m.form.save}
      </button>
    </>
  ) : finishing ? (
    <>
      <button type="button" onClick={() => setFinishing(false)} className={buttonClass('secondary')}>
        {m.form.cancel}
      </button>
      <button type="button" onClick={() => onComplete(appt, outcome, followUp)} className={buttonClass('primary')}>
        <CircleCheck size={18} aria-hidden="true" /> {m.appt.saveDone}
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => onShare(summary())} className={buttonClass('secondary', 'mr-auto')}>
        <Share2 size={16} aria-hidden="true" /> {m.prep.share}
      </button>
      <button type="button" onClick={() => setFinishing(true)} className={buttonClass('primary')}>
        <CircleCheck size={18} aria-hidden="true" /> {m.appt.markDone}
      </button>
    </>
  );

  return (
    <Modal
      open
      title={appt.done ? m.appt.viewNotes : m.prep.title}
      subtitle={`${appt.doctor}${appt.clinic ? ` · ${appt.clinic}` : ''} · ${f.longDate(when)} ${f.time(when)}`}
      onClose={onClose}
      footer={footer}
    >
      <div className="space-y-5">
        {!finishing && !appt.done && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {appt.location && (
              <span className="inline-flex min-w-0 items-center gap-1 text-slate-600 dark:text-slate-300">
                <MapPin size={14} aria-hidden="true" className="shrink-0" /> <span className="break-words">{appt.location}</span>
              </span>
            )}
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={() => onCalendar(appt, summary())}
                className={buttonClass('ghost', 'min-h-9 px-2.5')}
                aria-label={m.appt.calendar}
              >
                <CalendarPlus size={16} aria-hidden="true" /> <span className="hidden sm:inline">{m.appt.calendar}</span>
              </button>
              <button type="button" onClick={() => onEdit(appt)} className={buttonClass('ghost', 'min-h-9 px-2.5')} aria-label={m.appt.edit}>
                <Pencil size={16} aria-hidden="true" />
              </button>
            </span>
          </div>
        )}

        {(finishing || appt.done) && (
          <section className="space-y-4">
            <div>
              <label htmlFor={`${id}-outcome`} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {m.appt.outcome}
              </label>
              <textarea
                id={`${id}-outcome`}
                data-autofocus
                className={cx(inputClass, 'min-h-28 resize-y')}
                rows={4}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder={m.appt.outcomePlaceholder}
              />
            </div>
            {!appt.done && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{m.appt.followUp}</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup">
                  {[{ key: 'followUpNone' as const, days: null }, ...FOLLOW_UPS].map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      role="radio"
                      aria-checked={followUp === o.days}
                      onClick={() => setFollowUp(o.days)}
                      className={cx(
                        'min-h-10 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                        followUp === o.days
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                      )}
                    >
                      {m.appt[o.key]}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </section>
        )}

        <Section title={m.prep.toRaise} aside={visitNotes.length > 0 && !appt.done ? <span className="text-xs text-slate-500 dark:text-slate-400">{m.prep.hint}</span> : undefined}>
          {visitNotes.length === 0 && tips.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{appt.done ? m.notes.empty : m.prep.nothing}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {visitNotes.map((n) => (
                <NoteRow
                  key={n.id}
                  note={n}
                  meds={meds}
                  onToggle={(d) => onToggleNote(n.id, appt.id, d)}
                  onRemove={appt.done ? undefined : () => onRemoveNote(n)}
                />
              ))}
            </ul>
          )}
          {tips.length > 0 && (
            <div className="mt-3 rounded-2xl bg-sky-50 p-3 dark:bg-sky-500/10">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-sky-800 dark:text-sky-200">
                <Sparkles size={14} aria-hidden="true" /> {m.prep.suggested}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-sky-900 dark:text-sky-100">
                {tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
          {!appt.done && !finishing && (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
              <NoteComposer meds={meds} onAdd={onAddNote} />
            </div>
          )}
        </Section>

        {!finishing && !appt.done && reviews.length > 0 && (
          <Section title={m.prep.meds} aside={<span className="text-xs text-slate-500 dark:text-slate-400">{t(m.prep.since, { date: f.date(new Date(from)) })}</span>}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {reviews.map((r) => {
                const prn = r.med.schedule.type === 'asNeeded';
                const pct = r.adherence === null ? null : Math.round(r.adherence * 100);
                return (
                  <li key={r.med.id} className="flex items-center gap-3 py-2.5">
                    <MedIcon form={r.med.form} color={r.med.color} size="sm" />
                    <div className="min-w-0 grow">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{displayName(r.med)}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {t(m.card.perDose, { amount: f.amount(r.med.dosage, r.med.form) })} · {scheduleText(r.med, m, f)}
                      </p>
                      {isLowStock(r.med) && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{m.card.lowStock}</p>}
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      {prn ? (
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{f.plural(m.prep.prnUses, r.taken)}</p>
                      ) : pct !== null ? (
                        <p
                          className={cx(
                            'text-base font-bold tabular-nums',
                            pct >= 90 ? 'text-emerald-700 dark:text-emerald-400' : pct >= 70 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-400',
                          )}
                        >
                          {pct}%
                        </p>
                      ) : (
                        <p className="text-slate-400">—</p>
                      )}
                      {r.skipped > 0 && <p className="text-slate-500 dark:text-slate-400">{f.plural(m.prep.skipped, r.skipped)}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {!finishing && !appt.done && appt.bring.trim() && (
          <Section title={m.prep.bring}>
            <p className="flex gap-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
              <Backpack size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
              {appt.bring}
            </p>
          </Section>
        )}
      </div>
    </Modal>
  );
}

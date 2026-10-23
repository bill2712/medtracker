import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlarmClock, ChevronDown, Clock, PackagePlus, PartyPopper, Pill, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import type { Appointment, Medication } from '../types';
import { useI18n } from '../i18n';
import { adherence, compareMeds, getStatus, isLowStock, summarizeDay, summarizeRange, startOfDay } from '../lib/schedule';
import { displayName } from '../lib/describe';
import { MedicationCard } from './MedicationCard';
import { AppointmentSummary } from './VisitParts';
import { buttonClass, cx, MedIcon } from './ui';

type Handlers = {
  onTake: (m: Medication) => void;
  onSkip: (m: Medication) => void;
  onEdit: (m: Medication) => void;
  onLog: (m: Medication) => void;
  onCalendar: (m: Medication) => void;
  onRefill: (m: Medication) => void;
};

function Ring({ value, label }: { value: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90" role="img" aria-label={label}>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-slate-200 dark:stroke-slate-800" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, value))}
        className="stroke-emerald-500 transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}

function Dashboard({
  meds,
  now,
  nextAppt,
  openNotesCount,
  onOpenAppt,
}: {
  meds: Medication[];
  now: number;
  nextAppt: Appointment | null;
  openNotesCount: number;
  onOpenAppt: (a: Appointment) => void;
}) {
  const { m, f, t } = useI18n();
  const nowDate = new Date(now);
  const today = summarizeDay(meds, startOfDay(now), now);
  const week = adherence(summarizeRange(meds, 7, now));

  const statuses = meds.map((med) => ({ med, ...getStatus(med, now) }));
  const overdue = statuses.filter((s) => s.status === 'overdue').length;
  const dueNow = statuses.filter((s) => s.status === 'due').length;
  const low = meds.filter(isLowStock).length;
  const next = statuses
    .filter((s) => s.due && ['upcoming', 'due', 'overdue'].includes(s.status))
    .sort((a, b) => a.due!.getTime() - b.due!.getTime())[0];

  const hour = nowDate.getHours();
  const greeting = hour < 12 ? m.greeting.morning : hour < 18 ? m.greeting.afternoon : m.greeting.evening;
  const ratio = today.expected ? today.takenScheduled / today.expected : 0;

  return (
    <section aria-labelledby="dash-title" className="mb-6">
      <div className="mb-4">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{f.longDate(nowDate)}</p>
        <h1 id="dash-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          {greeting}
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
          <div className="relative">
            <Ring value={ratio} label={t(m.dashboard.takenOfExpected, { taken: today.takenScheduled, expected: today.expected })} />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {today.expected ? `${Math.round(Math.min(1, ratio) * 100)}%` : '—'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-500 dark:text-slate-400">{m.dashboard.todayDoses}</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {today.expected
                ? t(m.dashboard.takenOfExpected, { taken: f.number(today.takenScheduled), expected: f.number(today.expected) })
                : m.dashboard.noScheduled}
            </p>
            {today.expected > 0 && today.takenScheduled >= today.expected && (
              <p className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <PartyPopper size={14} aria-hidden="true" /> {m.dashboard.allDone}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
          {next ? <MedIcon form={next.med.form} color={next.med.color} /> : (
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <Clock size={22} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm text-slate-500 dark:text-slate-400">{m.dashboard.nextDose}</p>
            {next ? (
              <>
                <p className="truncate text-lg font-semibold text-slate-900 dark:text-white">{displayName(next.med)}</p>
                <p className={cx('text-sm', next.status === 'overdue' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300')}>
                  {f.relativeDateTime(next.due!, nowDate)}
                  {next.status === 'upcoming' && ` · ${f.duration(next.due!.getTime() - now)}`}
                </p>
              </>
            ) : (
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{m.dashboard.noUpcoming}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 sm:col-span-2 lg:col-span-1 dark:bg-slate-900 dark:ring-slate-800">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">{m.dashboard.adherence}</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {week === null ? '—' : `${Math.round(week * 100)}%`}
            </p>
          </div>
          <ul className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {overdue > 0 && (
              <li className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">
                <TriangleAlert size={12} aria-hidden="true" /> {f.plural(m.dashboard.overdue, overdue)}
              </li>
            )}
            {dueNow > 0 && (
              <li className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                <AlarmClock size={12} aria-hidden="true" /> {f.plural(m.dashboard.due, dueNow)}
              </li>
            )}
            {low > 0 && (
              <li className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                <PackagePlus size={12} aria-hidden="true" /> {f.plural(m.dashboard.lowStock, low)}
              </li>
            )}
          </ul>
        </div>
      </div>
      {nextAppt && (
        <div className="mt-3">
          <AppointmentSummary appt={nextAppt} now={now} notesCount={openNotesCount} onOpen={() => onOpenAppt(nextAppt)} emphasis />
        </div>
      )}
    </section>
  );
}

function CardGrid({ meds, now, handlers }: { meds: Medication[]; now: number; handlers: Handlers }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {meds.map((med) => (
          <motion.div
            key={med.id}
            layout="position"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <MedicationCard med={med} now={now} {...handlers} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function TodayView({
  meds,
  now,
  handlers,
  onAdd,
  onSample,
  nextAppt,
  openNotesCount,
  onOpenAppt,
}: {
  meds: Medication[];
  now: number;
  handlers: Handlers;
  onAdd: () => void;
  onSample: () => void;
  nextAppt: Appointment | null;
  openNotesCount: number;
  onOpenAppt: (a: Appointment) => void;
}) {
  const { m } = useI18n();

  const { scheduled, prn, completed } = useMemo(() => {
    const sorted = [...meds].sort((a, b) => compareMeds(a, b, now));
    return {
      scheduled: sorted.filter((x) => x.schedule.type !== 'asNeeded' && getStatus(x, now).status !== 'completed'),
      prn: sorted.filter((x) => x.schedule.type === 'asNeeded' && getStatus(x, now).status !== 'completed'),
      completed: sorted.filter((x) => getStatus(x, now).status === 'completed'),
    };
  }, [meds, now]);

  if (!meds.length) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <span className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Pill size={40} aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{m.empty.title}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{m.empty.body}</p>
        <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={onAdd} className={buttonClass('primary', 'text-base')}>
            <Plus size={20} aria-hidden="true" /> {m.empty.add}
          </button>
          <button type="button" onClick={onSample} className={buttonClass('secondary', 'text-base')}>
            <Sparkles size={18} aria-hidden="true" /> {m.empty.sample}
          </button>
        </div>
        <p className="mt-10 text-xs text-slate-500 dark:text-slate-500">{m.settings.disclaimer}</p>
      </div>
    );
  }

  const heading = (text: string, count: number) => (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {text}
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">{count}</span>
    </h2>
  );

  return (
    <>
      <Dashboard meds={meds} now={now} nextAppt={nextAppt} openNotesCount={openNotesCount} onOpenAppt={onOpenAppt} />
      {scheduled.length > 0 && (
        <section>
          {heading(m.sections.active, scheduled.length)}
          <CardGrid meds={scheduled} now={now} handlers={handlers} />
        </section>
      )}
      {prn.length > 0 && (
        <section className={scheduled.length ? 'mt-8' : ''}>
          {heading(m.sections.asNeeded, prn.length)}
          <CardGrid meds={prn} now={now} handlers={handlers} />
        </section>
      )}
      {completed.length > 0 && (
        <details className="group mt-8">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
            {m.sections.completed}
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {completed.length}
            </span>
            <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-3">
            <CardGrid meds={completed} now={now} handlers={handlers} />
          </div>
        </details>
      )}
    </>
  );
}

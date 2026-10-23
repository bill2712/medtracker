import { memo } from 'react';
import {
  AlarmClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  History,
  PackagePlus,
  Pencil,
  SkipForward,
  StickyNote,
  TriangleAlert,
  Utensils,
} from 'lucide-react';
import type { Medication } from '../types';
import { useI18n } from '../i18n';
import {
  daysLeft,
  getStatus,
  isLowStock,
  lastTakenLog,
  progress,
  remaining,
  takenAmount,
  tracksSupply,
  type MedStatus,
} from '../lib/schedule';
import { scheduleText } from '../lib/describe';
import { buttonClass, COLOR, cx, MedIcon } from './ui';

type Props = {
  med: Medication;
  now: number;
  onTake: (m: Medication) => void;
  onSkip: (m: Medication) => void;
  onEdit: (m: Medication) => void;
  onLog: (m: Medication) => void;
  onCalendar: (m: Medication) => void;
  onRefill: (m: Medication) => void;
};

const STATUS_STYLE: Record<MedStatus, string> = {
  overdue: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30',
  due: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30',
  notStarted: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30',
  upcoming: 'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700',
  prnReady: 'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700',
  prnWait: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30',
};

const iconBtn =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';

function MedicationCardImpl({ med, now, onTake, onSkip, onEdit, onLog, onCalendar, onRefill }: Props) {
  const { m, f, t } = useI18n();
  const { status, due } = getStatus(med, now);
  const tracked = tracksSupply(med);
  const low = isLowStock(med);
  const days = daysLeft(med);
  const last = lastTakenLog(med);
  const done = status === 'completed';
  const isPrn = med.schedule.type === 'asNeeded';

  let statusText: string;
  switch (status) {
    case 'overdue':
      statusText = t(m.status.overdue, { duration: f.duration(now - due!.getTime()) });
      break;
    case 'upcoming':
      statusText = t(m.status.upcoming, { duration: f.duration(due!.getTime() - now) });
      break;
    case 'prnWait':
      statusText = t(m.status.prnWait, { duration: f.duration(due!.getTime() - now) });
      break;
    default:
      statusText = m.status[status];
  }

  const takeLabel =
    status === 'notStarted' ? m.card.takeFirst : status === 'upcoming' || status === 'prnWait' ? m.card.takeEarly : m.card.take;
  const takeVariant = status === 'upcoming' || status === 'prnWait' ? 'secondary' : 'primary';
  const StatusIcon = done ? CheckCircle2 : status === 'overdue' ? TriangleAlert : status === 'due' ? AlarmClock : Clock;

  return (
    <article
      aria-labelledby={`med-${med.id}`}
      className={cx(
        'relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900',
        status === 'overdue'
          ? 'border-rose-200 dark:border-rose-500/40'
          : status === 'due'
            ? 'border-emerald-300 dark:border-emerald-500/40'
            : 'border-slate-200/80 dark:border-slate-800',
      )}
    >
      <span aria-hidden="true" className={cx('absolute inset-y-0 left-0 w-1.5', COLOR[med.color].bar)} />

      <header className="flex items-start gap-3">
        <MedIcon form={med.form} color={med.color} />
        <div className="min-w-0 grow">
          <h3 id={`med-${med.id}`} className="truncate text-lg font-semibold leading-tight text-slate-900 dark:text-white">
            {med.name}
            {med.strength && <span className="ml-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">{med.strength}</span>}
          </h3>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {t(m.card.perDose, { amount: f.amount(med.dosage, med.form) })} · {scheduleText(med, m, f)}
          </p>
          {med.instructions !== 'none' && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Utensils size={12} aria-hidden="true" />
              {m.instructions[med.instructions]}
            </p>
          )}
        </div>
        <button type="button" onClick={() => onEdit(med)} className={cx(iconBtn, '-mr-1 -mt-1 h-10 w-10 bg-transparent dark:bg-transparent')} aria-label={`${m.card.edit}: ${med.name}`}>
          <Pencil size={18} />
        </button>
      </header>

      <div className={cx('mt-4 flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ring-1', STATUS_STYLE[status])}>
        <StatusIcon size={20} aria-hidden="true" className="shrink-0" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{statusText}</p>
          {due && !done && (
            <p className="opacity-80">
              {isPrn ? m.card.lastTaken : m.card.nextAt}: {isPrn && last ? f.relativeDateTime(new Date(last.time), new Date(now)) : f.relativeDateTime(due, new Date(now))}
            </p>
          )}
          {!due && last && !done && (
            <p className="opacity-80">
              {m.card.lastTaken}: {f.relativeDateTime(new Date(last.time), new Date(now))}
            </p>
          )}
        </div>
      </div>

      {tracked && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">{m.card.progress}</span>
            <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
              {t(m.card.takenOfTotal, { taken: f.number(takenAmount(med)), total: f.amount(med.total, med.form) })}
            </span>
          </div>
          <div
            className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            role="progressbar"
            aria-label={m.card.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress(med) * 100)}
          >
            <div
              className={cx('h-full rounded-full transition-[width] duration-500', low ? 'bg-amber-400' : 'bg-emerald-500')}
              style={{ width: `${progress(med) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{t(m.card.left, { amount: f.amount(remaining(med), med.form) })}</span>
            <span className="inline-flex items-center gap-3">
              {days !== null && !done && <span>{f.plural(m.card.daysLeft, Math.round(days * 10) / 10)}</span>}
              {!done && !low && (
                <button
                  type="button"
                  onClick={() => onRefill(med)}
                  className="inline-flex items-center gap-1 rounded-md font-semibold text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-400"
                >
                  <PackagePlus size={13} aria-hidden="true" /> {m.card.refill}
                </button>
              )}
            </span>
          </div>
          {low && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <TriangleAlert size={16} aria-hidden="true" /> {m.card.lowStock}
              </span>
              <button type="button" onClick={() => onRefill(med)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20">
                <PackagePlus size={16} aria-hidden="true" /> {m.card.refill}
              </button>
            </div>
          )}
        </div>
      )}

      {med.notes.trim() && (
        <p className="mt-3 flex gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <StickyNote size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2">{med.notes}</span>
        </p>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        {done ? (
          <button type="button" onClick={() => onRefill(med)} className={buttonClass('soft', 'grow')}>
            <PackagePlus size={18} aria-hidden="true" /> {m.card.refill}
          </button>
        ) : (
          <button type="button" onClick={() => onTake(med)} className={buttonClass(takeVariant, 'grow text-base')}>
            <CheckCircle2 size={20} aria-hidden="true" /> {takeLabel}
          </button>
        )}
        {!done && !isPrn && status !== 'notStarted' && (
          <button type="button" onClick={() => onSkip(med)} className={iconBtn} aria-label={m.card.skip} title={m.card.skip}>
            <SkipForward size={18} />
          </button>
        )}
        <button type="button" onClick={() => onLog(med)} className={iconBtn} aria-label={m.card.log} title={m.card.log}>
          <History size={18} />
        </button>
        {!done && !isPrn && (
          <button type="button" onClick={() => onCalendar(med)} className={iconBtn} aria-label={m.card.calendar} title={m.card.calendar}>
            <CalendarPlus size={18} />
          </button>
        )}
      </div>
    </article>
  );
}

export const MedicationCard = memo(MedicationCardImpl);

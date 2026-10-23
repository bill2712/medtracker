import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, ChartColumn, Table2, Trash2 } from 'lucide-react';
import type { DoseLog, Medication } from '../types';
import { useI18n } from '../i18n';
import { adherence, startOfDay, summarizeRange, type DaySummary } from '../lib/schedule';
import { displayName } from '../lib/describe';
import { cx, MedIcon, Segmented } from './ui';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function DoseChart({ days, now }: { days: DaySummary[]; now: number }) {
  const { m, f, t } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const height = 180;
  const pad = { top: 12, right: 4, bottom: 24, left: 26 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...days.map((d) => Math.max(d.taken, d.expected)));
  const niceMax = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH;
  const col = innerW / days.length;
  const gap = 2;
  const barW = Math.max(2, Math.min(28, col - gap));
  const ticks = niceMax <= 4 ? Array.from({ length: niceMax + 1 }, (_, i) => i) : [0, niceMax / 2, niceMax];
  const labelEvery = days.length > 10 ? 5 : 1;
  const today = startOfDay(now).getTime();

  const hovered = hover !== null ? days[hover] : null;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={m.history.chartTitle} className="block overflow-visible">
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(v)}
                y2={y(v)}
                className={v === 0 ? 'stroke-slate-300 dark:stroke-slate-700' : 'stroke-slate-200/70 dark:stroke-slate-800'}
                strokeWidth={1}
              />
              <text x={pad.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px] tabular-nums dark:fill-slate-400">
                {f.number(v)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx0 = pad.left + i * col + col / 2;
            const h = Math.max(0, y(0) - y(d.taken));
            const r = Math.min(4, barW / 2, h);
            const x = cx0 - barW / 2;
            const top = y(d.taken);
            const isToday = d.day.getTime() === today;
            return (
              <g
                key={d.day.getTime()}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${f.dayLabel(d.day, new Date(now))}: ${t(m.history.tooltip, { taken: d.taken, expected: d.expected })}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              >
                <rect x={pad.left + i * col} y={pad.top} width={col} height={innerH} fill="transparent" />
                {hover === i && (
                  <rect x={pad.left + i * col} y={pad.top} width={col} height={innerH} className="fill-slate-100 dark:fill-slate-800/70" />
                )}
                {h > 0 && (
                  <path
                    d={`M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y(0)} Z`}
                    className="fill-emerald-500 dark:fill-emerald-400"
                  />
                )}
                {d.expected > 0 && (
                  <line
                    x1={x - 1}
                    x2={x + barW + 1}
                    y1={y(d.expected)}
                    y2={y(d.expected)}
                    strokeWidth={2}
                    strokeDasharray="3 2"
                    className="stroke-slate-500 dark:stroke-slate-400"
                  />
                )}
                {(i % labelEvery === 0 || i === days.length - 1) && (
                  <text
                    x={cx0}
                    y={height - 6}
                    textAnchor="middle"
                    className={cx('text-[10px]', isToday ? 'fill-slate-900 font-semibold dark:fill-white' : 'fill-slate-500 dark:fill-slate-400')}
                  >
                    {days.length > 10 ? f.date(d.day) : f.weekday(d.day)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hovered && hover !== null && (
        <div
          role="presentation"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-900"
          style={{
            left: Math.min(Math.max(pad.left + hover * col + col / 2, 70), width - 70),
            top: Math.max(y(Math.max(hovered.taken, hovered.expected)) - 6, 40),
          }}
        >
          <p className="font-semibold">{f.dayLabel(hovered.day, new Date(now))}</p>
          <p className="opacity-80">{t(m.history.tooltip, { taken: hovered.taken, expected: hovered.expected })}</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" aria-hidden="true" /> {m.history.taken}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-slate-500 dark:border-slate-400" aria-hidden="true" /> {m.history.scheduled}
        </span>
      </div>
    </div>
  );
}

function DoseTable({ days, now }: { days: DaySummary[]; now: number }) {
  const { m, f } = useI18n();
  return (
    <div className="max-h-80 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th scope="col" className="py-2 font-semibold">{m.history.date}</th>
            <th scope="col" className="py-2 text-right font-semibold">{m.history.taken}</th>
            <th scope="col" className="py-2 text-right font-semibold">{m.history.skipped}</th>
            <th scope="col" className="py-2 text-right font-semibold">{m.history.scheduled}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...days].reverse().map((d) => (
            <tr key={d.day.getTime()}>
              <th scope="row" className="py-2 text-left font-medium text-slate-700 dark:text-slate-300">
                {f.dayLabel(d.day, new Date(now))}
              </th>
              <td className="py-2 text-right tabular-nums">{d.taken}</td>
              <td className="py-2 text-right tabular-nums">{d.skipped}</td>
              <td className="py-2 text-right tabular-nums">{d.expected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryView({
  meds,
  now,
  onRemoveLog,
}: {
  meds: Medication[];
  now: number;
  onRemoveLog: (med: Medication, log: DoseLog) => void;
}) {
  const { m, f } = useI18n();
  const [range, setRange] = useState<'7' | '30'>('7');
  const [table, setTable] = useState(false);
  const days = useMemo(() => summarizeRange(meds, Number(range), now), [meds, range, now]);
  const rate = adherence(days);
  const taken = days.reduce((s, d) => s + d.taken, 0);
  const skipped = days.reduce((s, d) => s + d.skipped, 0);

  const groups = useMemo(() => {
    const from = days[0].day.getTime();
    const entries = meds
      .flatMap((med) => med.logs.map((log) => ({ med, log, ts: Date.parse(log.time) })))
      .filter((e) => e.ts >= from)
      .sort((a, b) => b.ts - a.ts);
    const map = new Map<number, typeof entries>();
    for (const e of entries) {
      const key = startOfDay(e.ts).getTime();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [meds, days]);

  const tile = (label: string, value: string) => (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{m.history.title}</h1>
        <Segmented
          label={m.history.title}
          value={range}
          onChange={setRange}
          className="w-48"
          options={[
            { value: '7', label: m.history.days7 },
            { value: '30', label: m.history.days30 },
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {tile(m.history.adherence, rate === null ? '—' : `${Math.round(rate * 100)}%`)}
        {tile(m.history.taken, f.number(taken))}
        {tile(m.history.skipped, f.number(skipped))}
      </div>

      <section className="mt-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900 dark:text-white">{m.history.chartTitle}</h2>
          <button
            type="button"
            onClick={() => setTable((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
          >
            {table ? <ChartColumn size={16} aria-hidden="true" /> : <Table2 size={16} aria-hidden="true" />}
            {table ? m.history.showChart : m.history.showTable}
          </button>
        </div>
        {table ? <DoseTable days={days} now={now} /> : <DoseChart days={days} now={now} />}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{m.history.log}</h2>
        {groups.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <BarChart3 size={32} className="mx-auto mb-2 opacity-40" aria-hidden="true" />
            {m.history.empty}
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([day, entries]) => (
              <div key={day}>
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{f.dayLabel(new Date(day), new Date(now))}</h3>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
                  {entries.map(({ med, log }) => (
                    <li key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                      <MedIcon form={med.form} color={med.color} size="sm" />
                      <div className="min-w-0 grow">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{displayName(med)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {f.time(new Date(log.time))} · {f.amount(log.amount, med.form)}
                        </p>
                      </div>
                      <span
                        className={cx(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          log.skipped
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
                        )}
                      >
                        {log.skipped ? m.log.skipped : m.log.taken}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveLog(med, log)}
                        aria-label={`${m.log.remove}: ${displayName(med)} ${f.time(new Date(log.time))}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

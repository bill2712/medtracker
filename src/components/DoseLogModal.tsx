import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DoseLog, Medication } from '../types';
import { useI18n } from '../i18n';
import { uid } from '../lib/storage';
import { displayName } from '../lib/describe';
import { buttonClass, cx, inputClass, Modal } from './ui';

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function DoseLogModal({
  med,
  onSave,
  onClose,
}: {
  med: Medication | null;
  onSave: (medId: string, logs: DoseLog[]) => void;
  onClose: () => void;
}) {
  const { m, t } = useI18n();
  const [logs, setLogs] = useState<DoseLog[]>([]);

  useEffect(() => {
    if (med) setLogs([...med.logs].reverse());
  }, [med]);

  const update = (id: string, patch: Partial<DoseLog>) => setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <Modal
      open={!!med}
      title={m.log.title}
      subtitle={med ? displayName(med) : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass('secondary')}>
            {m.log.cancel}
          </button>
          <button type="button" onClick={() => med && onSave(med.id, logs)} className={buttonClass('primary')}>
            {m.log.save}
          </button>
        </>
      }
    >
      <button
        type="button"
        onClick={() => med && setLogs((prev) => [{ id: uid(), time: new Date().toISOString(), amount: med.dosage }, ...prev])}
        className={buttonClass('ghost', 'w-full border-2 border-dashed border-slate-200 dark:border-slate-700')}
      >
        <Plus size={18} aria-hidden="true" /> {m.log.add}
      </button>

      {logs.length === 0 ? (
        <p className="py-8 text-center text-slate-500 dark:text-slate-400">{m.log.empty}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {logs.map((log, i) => (
            <li
              key={log.id}
              className={cx(
                'flex items-end gap-2 rounded-2xl p-3',
                log.skipped ? 'bg-amber-50/70 dark:bg-amber-500/5' : 'bg-slate-50 dark:bg-slate-800/60',
              )}
            >
              <div className="min-w-0 grow">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label htmlFor={`log-${log.id}`} className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t(m.log.entry, { n: logs.length - i })}
                  </label>
                  <div className="flex rounded-lg bg-white p-0.5 text-xs font-medium shadow-sm dark:bg-slate-900" role="radiogroup">
                    {(['taken', 'skipped'] as const).map((kind) => {
                      const active = kind === 'skipped' ? !!log.skipped : !log.skipped;
                      return (
                        <button
                          key={kind}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => update(log.id, { skipped: kind === 'skipped' ? true : undefined })}
                          className={cx(
                            'rounded-md px-2 py-1 transition-colors',
                            active
                              ? kind === 'skipped'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                              : 'text-slate-500 dark:text-slate-400',
                          )}
                        >
                          {m.log[kind]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input
                  id={`log-${log.id}`}
                  type="datetime-local"
                  className={cx(inputClass, 'py-2 text-sm')}
                  value={toLocalInput(log.time)}
                  max={toLocalInput(new Date(Date.now() + 86_400_000).toISOString())}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const d = new Date(e.target.value);
                    if (!Number.isNaN(d.getTime())) update(log.id, { time: d.toISOString() });
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setLogs((prev) => prev.filter((l) => l.id !== log.id))}
                aria-label={m.log.remove}
                title={m.log.remove}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{m.log.hint}</p>
    </Modal>
  );
}

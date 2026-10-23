import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DoseLog, Medication } from '../types';
import { loadMeds, normalizeMeds, saveMeds, uid } from '../lib/storage';
import { sortLogs, takenAmount } from '../lib/schedule';

export function useMedStore() {
  const [meds, setMeds] = useState<Medication[]>(loadMeds);
  const medsRef = useRef(meds);
  medsRef.current = meds;

  useEffect(() => saveMeds(meds), [meds]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'mt.v2.medications' && e.newValue) {
        try {
          setMeds(normalizeMeds(JSON.parse(e.newValue)));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((id: string, fn: (m: Medication) => Medication) => {
    setMeds((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const logDose = useCallback(
    (id: string, opts: { skipped?: boolean; time?: Date } = {}): string => {
      const logId = uid();
      update(id, (m) => {
        const log: DoseLog = {
          id: logId,
          time: (opts.time ?? new Date()).toISOString(),
          amount: m.dosage,
          ...(opts.skipped ? { skipped: true } : {}),
        };
        return { ...m, logs: sortLogs([...m.logs, log]) };
      });
      return logId;
    },
    [update],
  );

  const removeLog = useCallback(
    (medId: string, logId: string) => update(medId, (m) => ({ ...m, logs: m.logs.filter((l) => l.id !== logId) })),
    [update],
  );

  const restoreLog = useCallback(
    (medId: string, log: DoseLog) =>
      update(medId, (m) => (m.logs.some((l) => l.id === log.id) ? m : { ...m, logs: sortLogs([...m.logs, log]) })),
    [update],
  );

  const setLogs = useCallback(
    (medId: string, logs: DoseLog[]) => update(medId, (m) => ({ ...m, logs: sortLogs(logs) })),
    [update],
  );

  const upsert = useCallback((med: Medication) => {
    setMeds((prev) => (prev.some((m) => m.id === med.id) ? prev.map((m) => (m.id === med.id ? med : m)) : [...prev, med]));
  }, []);

  const remove = useCallback((id: string): { med: Medication; index: number } | null => {
    const index = medsRef.current.findIndex((m) => m.id === id);
    if (index < 0) return null;
    const med = medsRef.current[index];
    setMeds((prev) => prev.filter((m) => m.id !== id));
    return { med, index };
  }, []);

  const restore = useCallback((med: Medication, index: number) => {
    setMeds((prev) => {
      if (prev.some((m) => m.id === med.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, med);
      return next;
    });
  }, []);

  const refill = useCallback(
    (id: string, amount: number) =>
      update(id, (m) => {
        // When supply was not tracked yet, start counting from what has been taken so far.
        const base = m.total > 0 ? m.total : takenAmount(m);
        return { ...m, total: Math.round((base + amount) * 100) / 100 };
      }),
    [update],
  );

  return useMemo(
    () => ({ meds, setMeds, logDose, removeLog, restoreLog, setLogs, upsert, remove, restore, refill }),
    [meds, logDose, removeLog, restoreLog, setLogs, upsert, remove, restore, refill],
  );
}

export type MedStore = ReturnType<typeof useMedStore>;

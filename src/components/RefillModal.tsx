import { useEffect, useId, useState, type FormEvent } from 'react';
import { PackagePlus } from 'lucide-react';
import type { Medication } from '../types';
import { useI18n } from '../i18n';
import { remaining, tracksSupply } from '../lib/schedule';
import { displayName } from '../lib/describe';
import { buttonClass, Field, inputClass, Modal } from './ui';

export function RefillModal({
  med,
  onRefill,
  onClose,
}: {
  med: Medication | null;
  onRefill: (med: Medication, amount: number) => void;
  onClose: () => void;
}) {
  const { m, f, t } = useI18n();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const id = useId();

  useEffect(() => {
    if (med) {
      // Suggest the original pack size, or a 30-day supply when not counted yet.
      const guess = med.total > 0 ? med.total : med.dosage * 30;
      setValue(String(Math.round(guess * 100) / 100));
      setError('');
    }
  }, [med]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value.replace(',', '.'));
    if (!(n > 0) || !med) {
      setError(m.form.errors.dosage);
      return;
    }
    onRefill(med, n);
  };

  return (
    <Modal
      open={!!med}
      title={m.refill.title}
      subtitle={med ? displayName(med) : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass('secondary')}>
            {m.form.cancel}
          </button>
          <button type="submit" form={id} className={buttonClass('primary')}>
            <PackagePlus size={18} aria-hidden="true" /> {m.refill.confirm}
          </button>
        </>
      }
    >
      {med && (
        <form id={id} onSubmit={submit} className="space-y-3" noValidate>
          {tracksSupply(med) && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t(m.refill.current, { amount: f.amount(remaining(med), med.form) })}
            </p>
          )}
          <Field id={`${id}-amount`} label={`${m.refill.amount} (${f.plural(m.units[med.form], 2)})`} error={error}>
            <input
              id={`${id}-amount`}
              data-autofocus
              className={inputClass}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={!!error}
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}

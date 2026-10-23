import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bandage,
  Droplet,
  FlaskConical,
  GlassWater,
  Pill,
  Syringe,
  Tablets,
  Wind,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { MedColor, MedForm } from '../types';
import { useI18n } from '../i18n';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** Full class strings so Tailwind can see them. */
export const COLOR: Record<MedColor, { dot: string; soft: string; text: string; bar: string }> = {
  emerald: {
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  sky: { dot: 'bg-sky-500', soft: 'bg-sky-100 dark:bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', bar: 'bg-sky-500' },
  violet: {
    dot: 'bg-violet-500',
    soft: 'bg-violet-100 dark:bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
  },
  rose: { dot: 'bg-rose-500', soft: 'bg-rose-100 dark:bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300', bar: 'bg-rose-500' },
  amber: {
    dot: 'bg-amber-400',
    soft: 'bg-amber-100 dark:bg-amber-400/15',
    text: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-400',
  },
  orange: {
    dot: 'bg-orange-500',
    soft: 'bg-orange-100 dark:bg-orange-500/15',
    text: 'text-orange-700 dark:text-orange-300',
    bar: 'bg-orange-500',
  },
  teal: { dot: 'bg-teal-500', soft: 'bg-teal-100 dark:bg-teal-500/15', text: 'text-teal-700 dark:text-teal-300', bar: 'bg-teal-500' },
  slate: {
    dot: 'bg-slate-500',
    soft: 'bg-slate-200 dark:bg-slate-500/20',
    text: 'text-slate-700 dark:text-slate-300',
    bar: 'bg-slate-500',
  },
};

export const FORM_ICON: Record<MedForm, LucideIcon> = {
  tablet: Tablets,
  capsule: Pill,
  liquid: GlassWater,
  drops: Droplet,
  inhaler: Wind,
  injection: Syringe,
  patch: Bandage,
  other: FlaskConical,
};

export function MedIcon({ form, color, size = 'md' }: { form: MedForm; color: MedColor; size?: 'sm' | 'md' }) {
  const Icon = FORM_ICON[form];
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-2xl',
        COLOR[color].soft,
        COLOR[color].text,
        size === 'md' ? 'h-11 w-11' : 'h-8 w-8 rounded-xl',
      )}
    >
      <Icon size={size === 'md' ? 22 : 16} strokeWidth={2} />
    </span>
  );
}

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ' +
  'aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500/30';

const BUTTON = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 dark:disabled:bg-slate-700',
  secondary:
    'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  soft: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20',
  warning: 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  dangerGhost: 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10',
} as const;

export const buttonClass = (variant: keyof typeof BUTTON = 'primary', extra = '') =>
  cx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
    'disabled:cursor-not-allowed',
    BUTTON[variant],
    extra,
  );

export function Field({
  label,
  hint,
  error,
  optional,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {optional && <span className="font-normal text-slate-400"> ({optional})</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Open dialogs, top-most last: only the top one handles keys, and the page stays locked until all close.
const modalStack: string[] = [];

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { m } = useI18n();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    modalStack.push(titleId);
    document.body.style.overflow = 'hidden';

    const focusFirst = () => {
      const el = panel.current;
      if (!el) return;
      const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? el).focus();
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== titleId) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab' && panel.current) {
        const items = Array.from(panel.current.querySelectorAll(FOCUSABLE)) as HTMLElement[];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      const i = modalStack.indexOf(titleId);
      if (i >= 0) modalStack.splice(i, 1);
      if (!modalStack.length) document.body.style.overflow = '';
      if (previous?.isConnected) previous.focus();
    };
  }, [open, titleId]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl focus:outline-none sm:max-w-lg sm:rounded-3xl dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
                  {title}
                </h2>
                {subtitle && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={m.a11y.close}
                className="-mr-2 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grow overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900/80">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = 'primary',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { m } = useI18n();
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={buttonClass('secondary')} onClick={onClose}>
            {m.confirm.cancel}
          </button>
          <button
            type="button"
            data-autofocus
            className={buttonClass(tone === 'danger' ? 'danger' : 'primary')}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-slate-600 dark:text-slate-300">{body}</p>
    </Modal>
  );
}

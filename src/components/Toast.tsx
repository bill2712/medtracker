import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cx } from './ui';

type Tone = 'success' | 'info' | 'error';
type ToastInput = { message: string; tone?: Tone; action?: { label: string; onClick: () => void }; duration?: number };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const ICONS = { success: CheckCircle2, info: Info, error: TriangleAlert };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.duration ?? (t.action ? 6000 : 3500));
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="toast-region pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = ICONS[t.tone ?? 'success'];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                role={t.tone === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl dark:bg-slate-100 dark:text-slate-900"
              >
                <Icon
                  size={18}
                  aria-hidden="true"
                  className={cx(
                    'shrink-0',
                    t.tone === 'error' ? 'text-rose-400 dark:text-rose-600' : 'text-emerald-400 dark:text-emerald-600',
                  )}
                />
                <span className="grow">{t.message}</span>
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                    className="shrink-0 rounded-lg px-2 py-1 font-semibold text-emerald-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:text-emerald-700 dark:hover:bg-slate-900/10"
                  >
                    {t.action.label}
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

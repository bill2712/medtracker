/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { History, House, Languages, Pill, Plus, Settings as SettingsIcon, WifiOff, type LucideIcon } from 'lucide-react';
import type { DoseLog, Medication, MedColor, Settings, View } from './types';
import { MED_COLORS } from './types';
import { useI18n, pathForLang } from './i18n';
import { LANGUAGES, isLang } from './i18n/config';
import { useMedStore } from './hooks/useMedStore';
import { useDoseReminders, useInstallPrompt, useNow, useOnline, useTheme } from './hooks/useAppHooks';
import { getStatus, needsEarlyConfirm } from './lib/schedule';
import { clearAll, createBackup, DEFAULT_SETTINGS, loadSettings, parseBackup, saveSettings } from './lib/storage';
import { buildICS } from './lib/ics';
import { displayName, shareSummary } from './lib/describe';
import { downloadFile, readFile, safeFilename, shareText } from './lib/files';
import { requestPermission, showNotification } from './lib/notifications';
import { safePushState } from './lib/safeStorage';
import { sampleMeds } from './lib/sample';
import { ToastProvider, useToast } from './components/Toast';
import { ConfirmDialog, cx } from './components/ui';
import { TodayView } from './components/TodayView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { MedicationForm } from './components/MedicationForm';
import { DoseLogModal } from './components/DoseLogModal';
import { RefillModal } from './components/RefillModal';

const VIEWS: View[] = ['today', 'history', 'settings'];
const viewFromHash = (): View => {
  const v = window.location.hash.replace(/^#\/?/, '') as View;
  return VIEWS.includes(v) ? v : 'today';
};

function useHashView() {
  const [view, setView] = useState<View>(viewFromHash);
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((v: View) => {
    const hash = v === 'today' ? '' : `#/${v}`;
    if (window.location.hash !== hash) {
      safePushState(null, window.location.pathname + window.location.search + hash);
      setView(v);
    }
    window.scrollTo({ top: 0 });
  }, []);
  return [view, go] as const;
}

type Confirm =
  | { kind: 'early'; med: Medication; due: Date }
  | { kind: 'delete'; med: Medication }
  | { kind: 'reset' };

function Shell() {
  const { m, f, t, lang, setLang } = useI18n();
  const toast = useToast();
  const store = useMedStore();
  const { meds } = store;
  const now = useNow();
  const online = useOnline();
  const install = useInstallPrompt();
  const [view, go] = useHashView();
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const [editing, setEditing] = useState<{ med: Medication | null } | null>(null);
  const [logMed, setLogMed] = useState<Medication | null>(null);
  const [refillMed, setRefillMed] = useState<Medication | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  // Keep the last dialog's text on screen while it animates out.
  const lastConfirm = useRef<Confirm | null>(null);
  if (confirm) lastConfirm.current = confirm;
  const shown = confirm ?? lastConfirm.current;

  useTheme(settings.theme);
  useEffect(() => saveSettings(settings), [settings]);

  useDoseReminders(meds, settings.notifications, (med) => ({
    title: t(m.notify.title, { name: displayName(med) }),
    body:
      t(m.notify.body, { amount: f.amount(med.dosage, med.form) }) +
      (med.instructions !== 'none' ? ` ${m.instructions[med.instructions]}.` : ''),
  }));

  // Tab title shows how many doses need attention.
  const attention = meds.filter((x) => ['due', 'overdue'].includes(getStatus(x, now).status)).length;
  useEffect(() => {
    document.title = (attention ? `(${attention}) ` : '') + m.seo.title;
  }, [attention, m]);

  // A new service worker took over: offer a reload.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    const onChange = () => {
      if (hadController) toast({ message: m.update, tone: 'info', action: { label: m.reload, onClick: () => window.location.reload() }, duration: 15000 });
    };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange);
  }, [m, toast]);

  const nextColor = useMemo<MedColor>(() => {
    const used = new Set(meds.map((x) => x.color));
    return MED_COLORS.find((c) => !used.has(c)) ?? MED_COLORS[meds.length % MED_COLORS.length];
  }, [meds]);

  const doTake = useCallback(
    (med: Medication) => {
      const logId = store.logDose(med.id);
      navigator.vibrate?.(30);
      toast({
        message: t(m.toast.taken, { name: med.name }),
        action: { label: m.toast.undo, onClick: () => store.removeLog(med.id, logId) },
      });
    },
    [store, toast, m, t],
  );

  const handlers = useMemo(
    () => ({
      onTake: (med: Medication) => {
        const due = needsEarlyConfirm(med, Date.now());
        if (due) setConfirm({ kind: 'early', med, due });
        else doTake(med);
      },
      onSkip: (med: Medication) => {
        const logId = store.logDose(med.id, { skipped: true });
        toast({
          message: t(m.toast.skipped, { name: med.name }),
          tone: 'info',
          action: { label: m.toast.undo, onClick: () => store.removeLog(med.id, logId) },
        });
      },
      onEdit: (med: Medication) => setEditing({ med }),
      onLog: (med: Medication) => setLogMed(med),
      onRefill: (med: Medication) => setRefillMed(med),
      onCalendar: (med: Medication) => {
        const ics = buildICS([med], m, f);
        if (!ics) {
          toast({ message: m.toast.calendarEmpty, tone: 'info' });
          return;
        }
        downloadFile(`medtracker-${safeFilename(med.name)}.ics`, ics, 'text/calendar;charset=utf-8');
        toast({ message: m.toast.calendar });
      },
    }),
    [doTake, store, toast, m, f, t],
  );

  const removeLogWithUndo = (med: Medication, log: DoseLog) => {
    store.removeLog(med.id, log.id);
    toast({
      message: m.toast.saved,
      tone: 'info',
      action: { label: m.toast.undo, onClick: () => store.restoreLog(med.id, log) },
    });
  };

  const deleteMed = (med: Medication) => {
    const removed = store.remove(med.id);
    setEditing(null);
    if (removed) {
      toast({
        message: t(m.toast.deleted, { name: med.name }),
        tone: 'info',
        action: { label: m.toast.undo, onClick: () => store.restore(removed.med, removed.index) },
      });
    }
  };

  const settingsActions = {
    onTheme: (theme: Settings['theme']) => setSettings((s) => ({ ...s, theme })),
    onNotifications: async (on: boolean) => {
      if (!on) {
        setSettings((s) => ({ ...s, notifications: false }));
        return;
      }
      const permission = await requestPermission();
      if (permission === 'granted') {
        setSettings((s) => ({ ...s, notifications: true }));
        toast({ message: m.toast.notifOn });
      } else {
        setSettings((s) => ({ ...s, notifications: false }));
        toast({ message: m.toast.notifBlocked, tone: 'error' });
      }
    },
    onTestNotification: () => void showNotification(m.app.name, m.settings.testBody, 'test'),
    onCalendarAll: () => {
      const ics = buildICS(meds, m, f);
      if (!ics) {
        toast({ message: m.toast.calendarEmpty, tone: 'info' });
        return;
      }
      downloadFile('medtracker-reminders.ics', ics, 'text/calendar;charset=utf-8');
      toast({ message: m.toast.calendar });
    },
    onExport: () => {
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(`medtracker-backup-${date}.json`, JSON.stringify(createBackup(meds, settings), null, 2), 'application/json');
      toast({ message: m.toast.exported });
    },
    onImport: async (file: File) => {
      try {
        const { medications, settings: imported } = parseBackup(await readFile(file));
        const previous = meds;
        store.setMeds(medications);
        if (imported) setSettings((s) => ({ ...imported, notifications: s.notifications }));
        toast({
          message: f.plural(m.toast.imported, medications.length),
          action: { label: m.toast.undo, onClick: () => store.setMeds(previous) },
        });
      } catch {
        toast({ message: m.toast.importFailed, tone: 'error' });
      }
    },
    onShare: async () => {
      const result = await shareText(m.share.title, shareSummary(meds, m, f));
      if (result === 'copied') toast({ message: m.toast.copied });
    },
    onReset: () => setConfirm({ kind: 'reset' }),
  };

  const openAdd = () => setEditing({ med: null });

  const NAV: { view: View; label: string; icon: LucideIcon }[] = [
    { view: 'today', label: m.nav.today, icon: House },
    { view: 'history', label: m.nav.history, icon: History },
    { view: 'settings', label: m.nav.settings, icon: SettingsIcon },
  ];

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main"
        className="sr-only z-[70] rounded-lg bg-emerald-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {m.a11y.skip}
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <a
            href={pathForLang(lang)}
            onClick={(e) => {
              e.preventDefault();
              go('today');
            }}
            className="flex items-center gap-2 rounded-lg text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-400"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Pill size={20} aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{m.app.name}</span>
          </a>

          <nav aria-label={m.nav.main} className="ml-6 hidden gap-1 md:flex">
            {NAV.map((n) => (
              <button
                key={n.view}
                type="button"
                onClick={() => go(n.view)}
                aria-current={view === n.view ? 'page' : undefined}
                className={cx(
                  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  view === n.view
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                )}
              >
                <n.icon size={18} aria-hidden="true" /> {n.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <label className="relative inline-flex items-center">
              <span className="sr-only">{m.settings.language}</span>
              <Languages size={16} className="pointer-events-none absolute left-2.5 text-slate-500" aria-hidden="true" />
              <select
                value={lang}
                onChange={(e) => isLang(e.target.value) && void setLang(e.target.value)}
                className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} lang={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={openAdd}
              className="hidden h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 md:inline-flex dark:focus-visible:ring-offset-slate-950"
            >
              <Plus size={18} aria-hidden="true" /> {m.nav.add}
            </button>
          </div>
        </div>
        {!online && (
          <p role="status" className="flex items-center justify-center gap-2 bg-slate-800 px-4 py-1.5 text-xs font-medium text-white dark:bg-slate-200 dark:text-slate-900">
            <WifiOff size={14} aria-hidden="true" /> {m.offline}
          </p>
        )}
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-32 pt-6 focus:outline-none md:pb-16">
        {view === 'today' && (
          <TodayView
            meds={meds}
            now={now}
            handlers={handlers}
            onAdd={openAdd}
            onSample={() => {
              store.setMeds(sampleMeds(m));
              toast({ message: m.toast.sampleAdded });
            }}
          />
        )}
        {view === 'history' && <HistoryView meds={meds} now={now} onRemoveLog={removeLogWithUndo} />}
        {view === 'settings' && (
          <SettingsView settings={settings} actions={settingsActions} install={install} hasMeds={meds.length > 0} />
        )}

        <footer className="mt-16 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500">
          <p className="mx-auto max-w-xl">{m.settings.disclaimer}</p>
          <nav aria-label={m.settings.language} className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {LANGUAGES.map((l) => (
              <a
                key={l.code}
                href={pathForLang(l.code)}
                hrefLang={l.code}
                lang={l.code}
                onClick={(e) => {
                  e.preventDefault();
                  void setLang(l.code);
                }}
                className={cx('hover:text-emerald-700 hover:underline dark:hover:text-emerald-400', l.code === lang && 'font-semibold text-slate-700 dark:text-slate-300')}
              >
                {l.label}
              </a>
            ))}
          </nav>
        </footer>
      </main>

      {view === 'today' && meds.length > 0 && (
        <button
          type="button"
          onClick={openAdd}
          aria-label={m.nav.add}
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-transform hover:bg-emerald-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 md:hidden dark:focus-visible:ring-offset-slate-950"
        >
          <Plus size={26} aria-hidden="true" />
        </button>
      )}

      <nav
        aria-label={m.nav.main}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden dark:border-slate-800 dark:bg-slate-950/90"
      >
        <ul className="mx-auto grid max-w-md grid-cols-3">
          {NAV.map((n) => (
            <li key={n.view}>
              <button
                type="button"
                onClick={() => go(n.view)}
                aria-current={view === n.view ? 'page' : undefined}
                className={cx(
                  'flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500',
                  view === n.view ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400',
                )}
              >
                <span className={cx('rounded-full px-4 py-1 transition-colors', view === n.view && 'bg-emerald-100 dark:bg-emerald-500/15')}>
                  <n.icon size={22} aria-hidden="true" />
                </span>
                {n.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <MedicationForm
        open={!!editing}
        med={editing?.med ?? null}
        defaultColor={nextColor}
        onClose={() => setEditing(null)}
        onDelete={(med) => setConfirm({ kind: 'delete', med })}
        onSave={(med, isNew) => {
          store.upsert(med);
          setEditing(null);
          toast({ message: isNew ? t(m.toast.added, { name: med.name }) : m.toast.saved });
        }}
      />

      <DoseLogModal
        med={logMed}
        onClose={() => setLogMed(null)}
        onSave={(id, logs) => {
          store.setLogs(id, logs);
          setLogMed(null);
          toast({ message: m.toast.saved });
        }}
      />

      <RefillModal
        med={refillMed}
        onClose={() => setRefillMed(null)}
        onRefill={(med, amount) => {
          store.refill(med.id, amount);
          setRefillMed(null);
          toast({ message: t(m.toast.refilled, { name: med.name, amount: f.amount(amount, med.form) }) });
        }}
      />

      <ConfirmDialog
        open={confirm?.kind === 'early'}
        title={shown?.kind === 'early' && shown.med.schedule.type === 'asNeeded' ? m.confirm.prnTitle : m.confirm.earlyTitle}
        body={
          shown?.kind === 'early'
            ? t(shown.med.schedule.type === 'asNeeded' ? m.confirm.prnBody : m.confirm.earlyBody, {
                name: shown.med.name,
                time: f.relativeDateTime(shown.due, new Date(now)),
              })
            : ''
        }
        confirmLabel={m.confirm.takeAnyway}
        onConfirm={() => confirm?.kind === 'early' && doTake(confirm.med)}
        onClose={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title={m.confirm.deleteTitle}
        body={shown?.kind === 'delete' ? t(m.confirm.deleteBody, { name: shown.med.name }) : ''}
        confirmLabel={m.confirm.delete}
        tone="danger"
        onConfirm={() => confirm?.kind === 'delete' && deleteMed(confirm.med)}
        onClose={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm?.kind === 'reset'}
        title={m.confirm.resetTitle}
        body={m.confirm.resetBody}
        confirmLabel={m.confirm.erase}
        tone="danger"
        onConfirm={() => {
          clearAll();
          store.setMeds([]);
          setSettings(DEFAULT_SETTINGS);
          toast({ message: m.toast.erased });
          go('today');
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </MotionConfig>
  );
}

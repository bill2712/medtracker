import { useEffect, useRef, useState } from 'react';
import type { Appointment, Medication, Theme } from '../types';
import { getStatus } from '../lib/schedule';
import { showNotification } from '../lib/notifications';
import { storage } from '../lib/safeStorage';

/** Current time, refreshed on an interval and whenever the tab becomes visible again. */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

export function useTheme(theme: Theme) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
  );
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    canPrompt: !!event,
    installed,
    isIos,
    prompt: async () => {
      if (!event) return;
      await event.prompt();
      await event.userChoice.catch(() => undefined);
      setEvent(null);
    },
  };
}

const NOTIFIED_KEY = 'mt.notified';

/**
 * Fires a notification when each scheduled dose becomes due, while the page is alive.
 * Each due time is notified at most once (remembered across reloads).
 */
export function useDoseReminders(
  meds: Medication[],
  enabled: boolean,
  build: (m: Medication) => { title: string; body: string },
) {
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notified = storage.getJSON<Record<string, string>>(NOTIFIED_KEY) ?? {};
    const timers: number[] = [];

    const fire = (m: Medication, dueIso: string) => {
      if (notified[m.id] === dueIso) return;
      notified[m.id] = dueIso;
      storage.setJSON(NOTIFIED_KEY, notified);
      const { title, body } = buildRef.current(m);
      void showNotification(title, body, `dose-${m.id}`);
    };

    const now = Date.now();
    for (const m of meds) {
      const { status, due } = getStatus(m, now);
      if (!due || !['upcoming', 'due', 'overdue'].includes(status)) continue;
      const dueIso = due.toISOString();
      const wait = due.getTime() - now;
      if (wait <= 0) {
        // Only catch up on doses that became due recently, not days-old ones.
        if (wait > -6 * 3_600_000) fire(m, dueIso);
      } else if (wait < 2_147_000_000) {
        timers.push(window.setTimeout(() => fire(m, dueIso), wait));
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [meds, enabled]);
}

/** Notifies before each upcoming appointment at the chosen reminder offsets, while the page is alive. */
export function useAppointmentReminders(
  appointments: Appointment[],
  enabled: boolean,
  build: (a: Appointment) => { title: string; body: string },
) {
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notified = storage.getJSON<Record<string, string>>(NOTIFIED_KEY) ?? {};
    const timers: number[] = [];
    const now = Date.now();

    for (const a of appointments) {
      if (a.done) continue;
      const start = Date.parse(a.time);
      if (start < now) continue;
      const fire = (keys: string[]) => {
        for (const k of keys) notified[k] = a.time;
        storage.setJSON(NOTIFIED_KEY, notified);
        const { title, body } = buildRef.current(a);
        void showNotification(title, body, `appt-${a.id}`);
      };
      const missed: string[] = [];
      for (const min of a.reminders) {
        const key = `appt:${a.id}:${min}`;
        if (notified[key] === a.time) continue;
        const wait = start - min * 60_000 - now;
        if (wait <= 0) missed.push(key);
        else if (wait < 2_147_000_000) timers.push(window.setTimeout(() => fire([key]), wait));
      }
      // Reminders missed while the app was closed: one notification, as long as the visit has not started.
      if (missed.length) fire(missed);
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [appointments, enabled]);
}

import { useRef, type ReactNode } from 'react';
import {
  Bell,
  CalendarPlus,
  ChevronDown,
  Download,
  Languages,
  Monitor,
  Moon,
  Share2,
  Smartphone,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Settings, Theme } from '../types';
import { useI18n, pathForLang } from '../i18n';
import { LANGUAGES } from '../i18n/config';
import { notificationsSupported } from '../lib/notifications';
import { buttonClass, cx, Segmented } from './ui';

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
        <span className="text-emerald-600 dark:text-emerald-400" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
        'disabled:opacity-50',
        checked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700',
      )}
    >
      <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

export type SettingsActions = {
  onTheme: (t: Theme) => void;
  onNotifications: (on: boolean) => void;
  onTestNotification: () => void;
  onCalendarAll: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onShare: () => void;
  onReset: () => void;
};

export function SettingsView({
  settings,
  actions,
  install,
  hasMeds,
}: {
  settings: Settings;
  actions: SettingsActions;
  install: { canPrompt: boolean; installed: boolean; isIos: boolean; prompt: () => void };
  hasMeds: boolean;
}) {
  const { m, lang, setLang } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const supported = notificationsSupported();
  const permission = supported ? Notification.permission : 'denied';

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{m.settings.title}</h1>

      <Card title={m.settings.language} icon={<Languages size={20} />}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <a
                href={pathForLang(l.code) + '#/settings'}
                hrefLang={l.code}
                lang={l.code}
                aria-current={l.code === lang ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  void setLang(l.code);
                }}
                className={cx(
                  'flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                  l.code === lang
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300',
                )}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={m.settings.appearance} icon={<Sun size={20} />}>
        <Segmented
          label={m.settings.appearance}
          value={settings.theme}
          onChange={actions.onTheme}
          options={[
            { value: 'system', label: m.settings.themeSystem, icon: Monitor },
            { value: 'light', label: m.settings.themeLight, icon: Sun },
            { value: 'dark', label: m.settings.themeDark, icon: Moon },
          ]}
        />
      </Card>

      <Card title={m.settings.reminders} icon={<Bell size={20} />}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-200">{m.settings.notifications}</p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {supported ? m.settings.notificationsHint : m.settings.notificationsUnsupported}
            </p>
          </div>
          <Switch
            checked={settings.notifications && permission === 'granted'}
            onChange={actions.onNotifications}
            label={m.settings.notifications}
            disabled={!supported}
          />
        </div>
        {settings.notifications && permission === 'granted' && (
          <button type="button" onClick={actions.onTestNotification} className={buttonClass('secondary', 'mt-3')}>
            <Bell size={16} aria-hidden="true" /> {m.settings.test}
          </button>
        )}
        <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
          <button type="button" onClick={actions.onCalendarAll} disabled={!hasMeds} className={buttonClass('soft', 'w-full sm:w-auto')}>
            <CalendarPlus size={18} aria-hidden="true" /> {m.settings.calendarAll}
          </button>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{m.settings.calendarHint}</p>
        </div>
      </Card>

      {!install.installed && (install.canPrompt || install.isIos) && (
        <Card title={m.settings.install} icon={<Smartphone size={20} />}>
          <p className="text-sm text-slate-500 dark:text-slate-400">{m.settings.installHint}</p>
          {install.canPrompt ? (
            <button type="button" onClick={install.prompt} className={buttonClass('primary', 'mt-3')}>
              <Smartphone size={18} aria-hidden="true" /> {m.settings.install}
            </button>
          ) : (
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">{m.settings.installIos}</p>
          )}
        </Card>
      )}

      <Card title={m.settings.data} icon={<Download size={20} />}>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{m.settings.dataHint}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={actions.onExport} disabled={!hasMeds} className={buttonClass('secondary', 'justify-start')}>
            <Download size={18} aria-hidden="true" /> {m.settings.export}
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass('secondary', 'justify-start')}>
            <Upload size={18} aria-hidden="true" /> {m.settings.import}
          </button>
          <button type="button" onClick={actions.onShare} disabled={!hasMeds} className={buttonClass('secondary', 'justify-start')}>
            <Share2 size={18} aria-hidden="true" /> {m.settings.share}
          </button>
          <button type="button" onClick={actions.onReset} className={buttonClass('dangerGhost', 'justify-start')}>
            <Trash2 size={18} aria-hidden="true" /> {m.settings.reset}
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) actions.onImport(file);
            e.target.value = '';
          }}
        />
      </Card>

      <section aria-labelledby="about-title" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
        <h2 id="about-title" className="font-semibold text-slate-900 dark:text-white">
          {m.settings.about}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{m.seo.intro}</p>
        <h3 className="mt-5 text-sm font-semibold text-slate-800 dark:text-slate-200">{m.seo.featuresTitle}</h3>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {m.seo.features.map((feat) => (
            <li key={feat.title} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{feat.title}</p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{feat.text}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 text-sm font-semibold text-slate-800 dark:text-slate-200">{m.seo.faqTitle}</h3>
        <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          {m.seo.faq.map((item) => (
            <details key={item.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-5 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">{m.settings.disclaimer}</p>
        <p className="mt-3 text-xs text-slate-400">MedTracker v{__APP_VERSION__}</p>
      </section>
    </div>
  );
}

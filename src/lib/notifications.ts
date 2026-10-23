export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

const ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`;

/** Uses the service worker when present (required on Android), else the page API. */
export async function showNotification(title: string, body: string, tag: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const options: NotificationOptions = { body, tag, icon: ICON, badge: ICON, requireInteraction: true };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(title, options);
  } catch {
    /* some mobile browsers only allow SW notifications */
  }
}

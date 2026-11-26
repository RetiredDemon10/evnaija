export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export const NOTIFICATIONS_ENABLED_KEY = 'ev-naija.notifications-enabled'
export const NOTIFICATIONS_SEEN_KEY = 'ev-naija.notified-bookings'

export function isPwaSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function registerServiceWorker(): void {
  if (!isPwaSupported() || !import.meta.env.PROD) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      // The app must stay usable if a browser or corporate proxy blocks workers.
      console.warn('EV Naija service worker registration failed.', error)
    })
  })
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function notificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    notificationPermission() === 'granted' &&
    window.localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) !== 'false'
  )
}

export function setNotificationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled))
}

export interface LocalNotificationOptions {
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

export async function showLocalNotification(
  title: string,
  options: LocalNotificationOptions,
): Promise<void> {
  if (!notificationsEnabled()) return
  const payload = {
    type: 'SHOW_NOTIFICATION',
    title,
    options: {
      body: options.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: options.tag,
      requireInteraction: options.requireInteraction ?? false,
      data: { url: options.url ?? '/app/bookings' },
    },
  }

  if (isPwaSupported()) {
    try {
      const registration = await navigator.serviceWorker.ready
      registration.active?.postMessage(payload)
      return
    } catch {
      // Fall through to a page notification for browsers without an active worker.
    }
  }

  const notification = new Notification(title, {
    body: options.body,
    icon: '/icon-192.png',
    tag: options.tag,
  })
  notification.onclick = () => {
    window.focus()
    if (options.url) window.location.assign(options.url)
    notification.close()
  }
}

import { useState } from 'react'
import { BellRing, Send, ShieldCheck } from 'lucide-react'
import { SectionCard } from '@/components/ui/Data'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Feedback'
import {
  notificationPermission,
  notificationsEnabled,
  requestNotificationPermission,
  setNotificationsEnabled,
  showLocalNotification,
} from '@/lib/pwa'

export function DeviceNotificationsCard() {
  const toast = useToast()
  const [permission, setPermission] = useState(notificationPermission())
  const [enabled, setEnabled] = useState(notificationsEnabled())
  const [requesting, setRequesting] = useState(false)
  const unsupported = permission === 'unsupported'

  const enable = async () => {
    setRequesting(true)
    try {
      const result = await requestNotificationPermission()
      setPermission(result)
      if (result === 'granted') {
        setNotificationsEnabled(true)
        setEnabled(true)
        toast.success('Device notifications enabled', 'We will remind you about upcoming bookings on this device.')
      } else if (result === 'denied') {
        toast.error('Notifications blocked', 'Allow notifications for this site in your browser settings.')
      }
    } finally {
      setRequesting(false)
    }
  }

  const disable = () => {
    setNotificationsEnabled(false)
    setEnabled(false)
    toast.success('Device notifications paused', 'You can turn them back on at any time.')
  }

  const sendTest = async () => {
    await showLocalNotification('EV Naija test notification', {
      body: 'Your device notifications are working. We will remind you before an upcoming charging session.',
      url: '/app/bookings',
      tag: 'ev-naija-test',
    })
    toast.success('Test notification sent', 'Check your notification centre if you do not see it on screen.')
  }

  return (
    <SectionCard
      title="Device notifications"
      description="Local booking reminders while EV Naija is open. No marketing messages."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint text-midnight-800">
            <BellRing className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[12.5px] font-semibold text-midnight-900">
              {unsupported
                ? 'Not supported in this browser'
                : enabled
                  ? 'Reminders are on'
                  : permission === 'denied'
                    ? 'Notifications are blocked'
                    : 'Reminders are off'}
            </p>
            <p className="mt-0.5 max-w-lg text-[10.5px] leading-relaxed text-muted">
              {unsupported
                ? 'Use a browser that supports the Notification API to receive local reminders.'
                : permission === 'denied'
                  ? 'Update this site’s notification permission in your browser settings, then reload the page.'
                  : 'We send a local reminder 30 minutes before a confirmed session. Phone push while the app is closed requires a production push service.'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {enabled ? (
            <>
              <Button size="sm" variant="outline" onClick={() => void sendTest()}>
                <Send className="h-3.5 w-3.5" /> Send test
              </Button>
              <Button size="sm" variant="ghost" onClick={disable}>Turn off</Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => void enable()}
              loading={requesting}
              disabled={unsupported || permission === 'denied'}
            >
              <BellRing className="h-3.5 w-3.5" /> Enable notifications
            </Button>
          )}
        </div>
      </div>
      <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-charcoal-50 px-3 py-2.5 text-[9.5px] leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-lime-600" />
        Notifications are generated on your device from your own bookings. They never include payment credentials or full account details.
      </p>
    </SectionCard>
  )
}

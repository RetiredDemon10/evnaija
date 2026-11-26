import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { isStandalone, type BeforeInstallPromptEvent } from '@/lib/pwa'

const DISMISSED_KEY = 'ev-naija.install-prompt-dismissed'

export function PwaPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone() || sessionStorage.getItem(DISMISSED_KEY) === '1') return

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const onInstalled = () => {
      setVisible(false)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!visible || !promptEvent) return null

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  const install = async () => {
    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') setVisible(false)
      else dismiss()
    } finally {
      setPromptEvent(null)
    }
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-md rounded-2xl border border-midnight-900/10 bg-white p-4 shadow-[0_24px_70px_-24px_rgba(7,27,34,0.5)]">
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-midnight-900">Install EV Naija</p>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
            Add the app to your home screen for faster booking, offline access and local charging reminders.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={() => void install()}>
              <Download className="h-3.5 w-3.5" /> Install app
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="rounded-lg p-1 text-muted transition hover:bg-charcoal-50 hover:text-midnight-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

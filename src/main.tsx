import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/Feedback'
import { registerServiceWorker } from '@/lib/pwa'
import App from './App'
import '@/styles/fonts.css'
import '@/styles/index.css'

registerServiceWorker()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const message = (error as Error)?.message ?? ''
        if (/preview mode|not configured/i.test(message)) return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found. Check index.html.')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <MotionConfig reducedMotion="user">
              <App />
            </MotionConfig>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)

// Fade out the pre-paint boot splash once React has committed its first frame,
// so the visitor never sees a white screen while the bundle loads. A
// MutationObserver is used instead of requestAnimationFrame because rAF is
// throttled in background tabs, which would leave the splash covering the app.
const dismissBootSplash = () => {
  const splash = document.getElementById('boot-splash')
  if (!splash || splash.dataset.hidden === 'true') return
  splash.dataset.hidden = 'true'
  window.setTimeout(() => splash.remove(), 400)
}

if (rootElement.childElementCount > 0) {
  dismissBootSplash()
} else {
  const observer = new MutationObserver(() => {
    if (rootElement.childElementCount === 0) return
    observer.disconnect()
    dismissBootSplash()
  })
  observer.observe(rootElement, { childList: true })
  // Last-resort safety net so the splash can never permanently block the UI.
  window.setTimeout(() => {
    observer.disconnect()
    dismissBootSplash()
  }, 6000)
}

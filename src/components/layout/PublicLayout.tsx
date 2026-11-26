import { useEffect } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { ScrollProgress } from '@/components/common/ScrollProgress'
import { EASE } from '@/lib/motion'

export function PublicLayout() {
  const location = useLocation()
  const outlet = useOutlet()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  return (
    <div className="flex min-h-screen flex-col bg-mint-50">
      <ScrollProgress />
      <SiteHeader />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="flex-1"
        >
          {outlet}
        </motion.main>
      </AnimatePresence>
      <SiteFooter />
    </div>
  )
}

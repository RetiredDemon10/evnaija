import { motion, useScroll, useSpring } from 'framer-motion'

/**
 * Thin lime progress bar pinned to the very top of the viewport.
 * Purely decorative, so it is hidden from assistive tech.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 260, damping: 40, restDelta: 0.001 })

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-gradient-to-r from-lime-500 via-lime to-lime-300"
    />
  )
}

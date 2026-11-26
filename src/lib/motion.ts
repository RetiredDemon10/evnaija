import type { Transition, Variants } from 'framer-motion'

/** Shared easing curve used across the site for a consistent, premium feel. */
export const EASE = [0.22, 1, 0.36, 1] as const

/** Snappy spring for interactive elements such as the nav underline. */
export const spring: Transition = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }

/** Default viewport config so scroll reveals only fire once, slightly before entering view. */
export const viewportOnce = { once: true, margin: '-60px' } as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: EASE } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: EASE } },
}

/** Parent that reveals its children one after another. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

/**
 * Full-bleed hero background video.
 *
 * Plays an ordered playlist of muted clips with a cross-fade, so the hero can
 * tell a short story (e.g. a car arriving at a station, then charging).
 *
 * Performance: the poster image paints immediately and the video bytes are not
 * requested until the browser is idle, so the clips never compete with the
 * critical CSS/JS/fonts for bandwidth. The component falls back to the poster
 * when the visitor prefers reduced motion, has Save-Data enabled, or the media
 * cannot be played.
 */
export function HeroVideo({
  clips,
  poster,
  className,
}: {
  clips: string[]
  poster: string
  className?: string
}) {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const [active, setActive] = useState(0)
  const [fallback, setFallback] = useState(false)
  const [armed, setArmed] = useState(false)

  // Respect reduced-motion and data-saving preferences.
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const evaluate = () => setFallback(motionQuery.matches || Boolean(connection?.saveData))
    evaluate()
    motionQuery.addEventListener('change', evaluate)
    return () => motionQuery.removeEventListener('change', evaluate)
  }, [])

  // Start fetching the clips only once the browser is idle (or shortly after
  // load at the latest) so the poster is the only hero request on the critical
  // path.
  useEffect(() => {
    if (fallback || armed || clips.length === 0) return
    const idleWindow = window as IdleWindow
    if (typeof idleWindow.requestIdleCallback === 'function') {
      const handle = idleWindow.requestIdleCallback(() => setArmed(true), { timeout: 2000 })
      return () => idleWindow.cancelIdleCallback?.(handle)
    }
    const timeout = window.setTimeout(() => setArmed(true), 1200)
    return () => window.clearTimeout(timeout)
  }, [fallback, armed, clips.length])

  // Only the active clip plays; the rest stay paused so the sequence is exact.
  useEffect(() => {
    if (!armed || fallback) return
    videoRefs.current.forEach((video, index) => {
      if (!video) return
      if (index === active) {
        video.currentTime = 0
        void video.play().catch(() => setFallback(true))
      } else {
        video.pause()
      }
    })
  }, [armed, active, fallback])

  return (
    <>
      <img
        src={poster}
        alt=""
        aria-hidden
        decoding="async"
        className={cn('h-full w-full object-cover', className)}
      />
      {!fallback &&
        armed &&
        clips.map((src, index) => (
          <video
            key={src}
            ref={(element) => {
              videoRefs.current[index] = element
            }}
            src={src}
            muted
            playsInline
            preload="auto"
            autoPlay={index === 0}
            disablePictureInPicture
            onEnded={() => setActive((current) => (current + 1) % clips.length)}
            onError={() => setFallback(true)}
            aria-hidden
            style={{ opacity: index === active ? 1 : 0 }}
            className={cn(
              'pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-out',
              className,
            )}
          />
        ))}
    </>
  )
}

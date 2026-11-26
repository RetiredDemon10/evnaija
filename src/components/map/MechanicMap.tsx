import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Mechanic } from '@/types'
import { env } from '@/lib/env'
import { cn, escapeHtml, formatNaira } from '@/lib/utils'

maplibregl.setWorkerUrl(maplibreWorkerUrl)

const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
}

export function MechanicMap({
  mechanics,
  selectedId,
  onSelect,
  className,
  height = 520,
  interactive = true,
}: {
  mechanics: Mechanic[]
  selectedId?: string | null
  onSelect?: (mechanic: Mechanic) => void
  className?: string
  height?: number
  interactive?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: env.mapsStyleUrl
          ? env.mapsStyleUrl.includes('{key}')
            ? env.mapsStyleUrl.replace('{key}', env.mapsApiKey)
            : env.mapsStyleUrl
          : OSM_STYLE,
        center: [6.4541, 9.0765],
        zoom: 5.6,
        interactive,
        attributionControl: false,
        transformRequest: (url: string) => {
          if (env.mapsApiKey && url.includes('mapbox.com')) {
            return { url: `${url}${url.includes('?') ? '&' : '?'}access_token=${env.mapsApiKey}` }
          }
          return { url }
        },
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      mapRef.current = map
      return () => {
        map.remove()
        mapRef.current = null
      }
    } catch {
      setFailed(true)
    }
  }, [interactive])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []
    if (!mechanics.length) return

    const bounds = new maplibregl.LngLatBounds()
    for (const mechanic of mechanics) {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `ev-marker${selectedId === mechanic.id ? ' is-selected' : ''}`
      el.setAttribute('aria-label', `View ${mechanic.business_name}`)
      el.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg>`
      el.addEventListener('click', () => {
        onSelect?.(mechanic)
        map.flyTo({ center: [mechanic.longitude, mechanic.latitude], zoom: 13, duration: 800 })
      })
      const safeName = escapeHtml(mechanic.business_name)
      const safeCity = escapeHtml(mechanic.city)
      const rate = mechanic.hourly_rate ? `${formatNaira(mechanic.hourly_rate)}/hr` : 'Request a quote'
      const popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: '240px' }).setHTML(`
        <div style="font-family:Onest,sans-serif;background:#fff;padding:14px 16px;">
          <p style="margin:0;font-family:'Bricolage Grotesque',sans-serif;font-size:14px;font-weight:600;color:#071B22;">${safeName}</p>
          <p style="margin:3px 0 0;font-size:11px;color:#829194;">${safeCity}, ${escapeHtml(mechanic.state)}</p>
          <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid #eef2f2;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#071B22;">${rate}</span>
            <span style="font-size:11px;color:#059669;">★ ${mechanic.rating_average.toFixed(1)}</span>
          </div>
          <a href="/mechanics/${encodeURIComponent(mechanic.id)}" style="display:block;margin-top:10px;background:#C6F36A;color:#071B22;text-align:center;padding:8px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">View mechanic</a>
        </div>
      `)
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([mechanic.longitude, mechanic.latitude])
        .setPopup(popup)
        .addTo(map)
      markersRef.current.push(marker)
      bounds.extend([mechanic.longitude, mechanic.latitude])
    }

    if (mechanics.length === 1) {
      map.flyTo({ center: [mechanics[0].longitude, mechanics[0].latitude], zoom: 13, duration: 500 })
    } else {
      map.fitBounds(bounds, { padding: 70, maxZoom: 12, duration: 600 })
    }
  }, [mechanics, selectedId, onSelect])

  if (failed) {
    return (
      <div className={cn('relative overflow-hidden rounded-3xl border border-midnight-900/10 bg-midnight-900', className)} style={{ height }}>
        <div className="absolute inset-0 dotted-grid opacity-20" />
        <div className="relative flex h-full flex-col items-center justify-center p-6 text-center">
          <p className="font-display text-lg font-semibold text-white">Interactive map unavailable</p>
          <p className="mt-1 max-w-sm text-xs text-white/50">The mechanic list is still fully available.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('overflow-hidden rounded-3xl border border-midnight-900/10 bg-mint-100', className)}
      style={{ height }}
      role="application"
      aria-label="Map of EV mechanics"
    />
  )
}

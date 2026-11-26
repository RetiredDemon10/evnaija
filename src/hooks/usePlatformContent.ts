import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listPlatformSettings } from '@/services/admin'

export interface PlatformContent {
  heroHeadline: string
  heroSubheadline: string
  announcement: string
  footerTagline: string
  supportEmail: string
  supportPhone: string
  instagram: string
  x: string
  linkedin: string
}

const DEFAULTS = {
  hero_headline: 'Power your journey. Charge without limits.',
  hero_subheadline:
    'Discover reliable EV charging stations across Nigeria. Find a charger, reserve your spot and get back on the road with confidence.',
  homepage_announcement: '',
  footer_tagline:
    'Nigeria’s premium EV charging marketplace. Discover verified stations, reserve your charger and pay securely — from Lagos to Abuja and Port Harcourt.',
  support_email: 'support@evnaija.ng',
  support_phone: '+234 800 000 0000',
  social_instagram: 'https://instagram.com/evnaija',
  social_x: 'https://x.com/evnaija',
  social_linkedin: 'https://linkedin.com/company/evnaija',
} as const

type ContentKey = keyof typeof DEFAULTS

function readSetting(settings: { key: string; value: Record<string, unknown> }[], key: ContentKey) {
  const setting = settings.find((item) => item.key === key)
  const value = setting?.value?.value
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : DEFAULTS[key]
}

/**
 * Public marketing copy is stored in platform_settings and can be changed from
 * the admin console. Defaults keep the site complete before the first publish.
 */
export function usePlatformContent(): PlatformContent {
  const { data: settings = [] } = useQuery({
    queryKey: ['platform-content'],
    queryFn: listPlatformSettings,
    staleTime: 5 * 60_000,
  })

  return useMemo(
    () => ({
      heroHeadline: readSetting(settings, 'hero_headline'),
      heroSubheadline: readSetting(settings, 'hero_subheadline'),
      announcement: readSetting(settings, 'homepage_announcement') || '',
      footerTagline: readSetting(settings, 'footer_tagline'),
      supportEmail: readSetting(settings, 'support_email'),
      supportPhone: readSetting(settings, 'support_phone'),
      instagram: readSetting(settings, 'social_instagram'),
      x: readSetting(settings, 'social_x'),
      linkedin: readSetting(settings, 'social_linkedin'),
    }),
    [settings],
  )
}

/**
 * Splits a headline into a plain lead and a highlighted closing phrase while
 * preserving the original sentence punctuation. Falls back to highlighting the
 * final two words for fully custom copy.
 */
export function splitHeadline(headline: string) {
  const chargeIndex = headline.indexOf('Charge')
  if (chargeIndex > 0) {
    return {
      lead: headline.slice(0, chargeIndex).trimEnd(),
      accent: 'Charge',
      tail: headline.slice(chargeIndex + 'Charge'.length),
    }
  }
  const words = headline.trim().split(/\s+/)
  if (words.length < 3) return { lead: '', accent: headline, tail: '' }
  return {
    lead: words.slice(0, -2).join(' '),
    accent: words.slice(-2).join(' '),
    tail: '',
  }
}

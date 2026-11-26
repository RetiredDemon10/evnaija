const raw = import.meta.env
const browserOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
const cleanUrl = (value: string | undefined) => value?.trim().replace(/\/+$/, '') ?? ''

export const env = {
  supabaseUrl: (raw.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '',
  supabaseAnonKey: (raw.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '',
  mapsApiKey: (raw.VITE_MAPS_API_KEY as string | undefined)?.trim() ?? '',
  mapsStyleUrl: (raw.VITE_MAPS_STYLE_URL as string | undefined)?.trim() ?? '',
  appUrl: cleanUrl(raw.VITE_APP_URL as string | undefined) || browserOrigin,
  /** Canonical production origin used for SEO. Never derive this from preview. */
  siteUrl: cleanUrl(raw.VITE_SITE_URL as string | undefined) || 'https://evnaija.ng',
  paystackPublicKey: (raw.VITE_PAYSTACK_PUBLIC_KEY as string | undefined)?.trim() ?? '',
  demoMode: (raw.VITE_DEMO_MODE as string | undefined)?.trim() === 'true',
}

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey && env.supabaseUrl.startsWith('http'),
)

/**
 * Preview mode renders the full product against a clearly-labelled local fixture
 * dataset so the experience can be evaluated before credentials are supplied.
 * It is enabled automatically only when Supabase creds are absent, or explicitly
 * with VITE_DEMO_MODE=true. Production never uses fixtures.
 */
export const isPreviewMode = !isSupabaseConfigured || env.demoMode

export const isPaystackConfigured = Boolean(env.paystackPublicKey)

export const isMapsConfigured = Boolean(env.mapsApiKey && env.mapsStyleUrl)

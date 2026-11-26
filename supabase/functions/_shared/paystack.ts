import { requireEnv } from './http.ts'

const PAYSTACK_BASE = 'https://api.paystack.co'

export class PaystackError extends Error {
  status: number
  details: unknown

  constructor(message: string, status = 502, details?: unknown) {
    super(message)
    this.name = 'PaystackError'
    this.status = status
    this.details = details
  }
}

export async function paystackRequest<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const secret = requireEnv('PAYSTACK_SECRET_KEY')
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  const payload = await response.json().catch(() => null) as
    | { status?: boolean; message?: string; data?: T }
    | null

  if (!response.ok || !payload || payload.status === false) {
    throw new PaystackError(
      payload?.message ?? `Paystack request failed with HTTP ${response.status}.`,
      response.status,
      payload,
    )
  }

  return payload.data as T
}

export interface PaystackTransaction {
  id: number
  status: string
  reference: string
  amount: number
  currency: string
  channel?: string
  gateway_response?: string
  paid_at?: string
  customer?: { email?: string }
}

export async function verifyPaystackTransaction(reference: string) {
  return paystackRequest<PaystackTransaction>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  )
}

export async function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false
  const secret = requireEnv('PAYSTACK_SECRET_KEY')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.toLowerCase().charCodeAt(index)
  }
  return mismatch === 0
}

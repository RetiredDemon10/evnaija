import { adminClient } from './supabase.ts'
import type { PaystackTransaction } from './paystack.ts'

const CHANNELS = new Set(['card', 'bank_transfer', 'ussd', 'mobile_money', 'wallet', 'paystack'])

function paymentChannel(channel?: string) {
  return channel && CHANNELS.has(channel) ? channel : null
}

export async function settlePaystackTransaction(
  reference: string,
  transaction: PaystackTransaction,
  source: 'verify' | 'webhook',
) {
  if (transaction.status !== 'success') {
    throw new Error(`Paystack transaction is ${transaction.status}, not successful.`)
  }

  const { data, error } = await adminClient().rpc('settle_payment', {
    p_reference: reference,
    p_paystack_reference: transaction.reference ?? reference,
    p_amount: Number(transaction.amount) / 100,
    p_currency: transaction.currency ?? 'NGN',
    p_channel: paymentChannel(transaction.channel),
    p_gateway_response: transaction.gateway_response ?? transaction.status,
    p_paid_at: transaction.paid_at ?? new Date().toISOString(),
  })

  if (error) throw error
  return { ...(data as Record<string, unknown>), source }
}

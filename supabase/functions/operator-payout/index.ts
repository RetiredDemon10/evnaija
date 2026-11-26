import { json, methodNotAllowed, optionsResponse } from '../_shared/http.ts'
import { adminClient, requireAdmin } from '../_shared/supabase.ts'
import { paystackRequest } from '../_shared/paystack.ts'

interface PaystackBank {
  name: string
  code: string
}

interface PaystackRecipient {
  recipient_code: string
}

interface PaystackTransfer {
  reference: string
  status: string
  transfer_code?: string
  otp?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return methodNotAllowed()

  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({})) as { payoutId?: string }
    if (!body.payoutId) return json({ success: false, error: 'payoutId is required.' }, 400)

    const db = adminClient()
    const { data: payout, error: payoutError } = await db
      .from('payout_requests')
      .select('*, account:payout_accounts(*)')
      .eq('id', body.payoutId)
      .maybeSingle()

    if (payoutError) throw payoutError
    if (!payout) return json({ success: false, error: 'Payout request not found.' }, 404)
    if (payout.status === 'paid') {
      return json({ success: true, message: 'Payout already sent.', payout })
    }
    if (!['approved', 'processing'].includes(payout.status)) {
      return json({ success: false, error: 'Approve this payout before sending the transfer.' }, 409)
    }

    const account = (payout as { account?: Record<string, unknown> | null }).account
    if (!account) return json({ success: false, error: 'Payout account not found.' }, 404)

    let recipientCode = account.recipient_code ? String(account.recipient_code) : ''

    if (!recipientCode) {
      const banks = await paystackRequest<PaystackBank[]>('/bank?currency=NGN')
      const bankName = String(account.bank_name ?? '').trim().toLowerCase()
      const bank = banks.find(
        (item) =>
          item.code === String(account.bank_name ?? '') ||
          item.name.trim().toLowerCase() === bankName ||
          item.name.trim().toLowerCase().includes(bankName) ||
          bankName.includes(item.name.trim().toLowerCase()),
      )
      if (!bank) {
        return json({
          success: false,
          error: 'Could not match the saved bank to a Paystack bank code. Update the payout account with the exact bank name.',
        }, 422)
      }

      const recipient = await paystackRequest<PaystackRecipient>('/transferrecipient', {
        method: 'POST',
        body: {
          type: 'nuban',
          name: account.account_name,
          account_number: account.account_number,
          bank_code: bank.code,
          currency: 'NGN',
        },
      })
      recipientCode = recipient.recipient_code

      const { error: recipientError } = await db
        .from('payout_accounts')
        .update({ recipient_code: recipientCode })
        .eq('id', account.id)
      if (recipientError) throw recipientError
    }

    let existingReference = payout.paystack_transfer_reference
      ? String(payout.paystack_transfer_reference)
      : ''

    if (existingReference) {
      const { data: existing } = await db
        .from('payout_requests')
        .select('id')
        .eq('id', payout.id)
        .maybeSingle()
      if (existing) {
        const verified = await paystackRequest<PaystackTransfer>(
          `/transfer/verify/${encodeURIComponent(existingReference)}`,
        ).catch(() => null)

        if (verified?.status === 'success') {
          const { data: settled, error } = await db.rpc('settle_payout', {
            p_payout_id: payout.id,
            p_reference: existingReference,
            p_status: 'paid',
          })
          if (error) throw error
          return json({ success: true, message: 'Transfer confirmed.', payout: (settled as Record<string, unknown>).payout ?? settled })
        }
        if (verified && ['pending', 'otp', 'processing', 'received'].includes(verified.status)) {
          const { data: settled, error } = await db.rpc('settle_payout', {
            p_payout_id: payout.id,
            p_reference: existingReference,
            p_status: 'processing',
          })
          if (error) throw error
          return json({
            success: true,
            message: 'Transfer is awaiting Paystack processing.',
            otp_required: verified.status === 'otp',
            payout: (settled as Record<string, unknown>).payout ?? settled,
          })
        }
        // A failed/abandoned transfer gets a fresh reference below.
      }
      existingReference = ''
    }

    const reference = `PO-${payout.id}-${Date.now()}`
    const transfer = await paystackRequest<PaystackTransfer>('/transfer', {
      method: 'POST',
      body: {
        source: 'balance',
        amount: Math.round(Number(payout.amount) * 100),
        recipient: recipientCode,
        reason: `EV Naija operator payout ${payout.id}`,
        reference,
        currency: 'NGN',
      },
    })

    const status = transfer.status === 'success'
      ? 'paid'
      : transfer.status === 'failed'
        ? 'rejected'
        : 'processing'

    const { data: settled, error: settleError } = await db.rpc('settle_payout', {
      p_payout_id: payout.id,
      p_reference: transfer.reference ?? reference,
      p_status: status,
    })
    if (settleError) throw settleError

    return json({
      success: status !== 'rejected',
      message: status === 'paid'
        ? 'Transfer sent successfully.'
        : status === 'rejected'
          ? 'Paystack rejected the transfer. Review the destination account and retry.'
          : 'Transfer queued with Paystack.',
      otp_required: transfer.status === 'otp',
      transfer,
      payout: (settled as Record<string, unknown>).payout ?? settled,
    })
  } catch (error) {
    console.error('operator-payout', error)
    return json({ success: false, error: (error as Error).message }, 400)
  }
})

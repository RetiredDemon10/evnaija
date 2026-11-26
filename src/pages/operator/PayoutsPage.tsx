import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, CreditCard, Landmark, Plus, ShieldCheck, Wallet } from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import {
  listOperatorTransactions,
  listPayoutAccounts,
  listPayoutRequests,
  requestPayout,
  savePayoutAccount,
} from '@/services/operator'
import type { PayoutAccount } from '@/types'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Form'
import { PayoutStatusBadge } from '@/components/booking/StatusBadges'
import { DetailRow, InfoNote, TableEmpty } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { NIGERIAN_BANKS } from '@/lib/constants'
import { SITE_FEES } from '@/lib/fees'
import { formatDate, formatNaira, humanize } from '@/lib/utils'

const ACCOUNT_BLANK = { bank_name: '', account_name: '', account_number: '', is_default: true }

export default function PayoutsPage() {
  const { operatorId, stats, isLoading } = useOperatorData()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [accountOpen, setAccountOpen] = useState(false)
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [accountForm, setAccountForm] = useState(ACCOUNT_BLANK)
  const [editingAccount, setEditingAccount] = useState<PayoutAccount | null>(null)
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [saving, setSaving] = useState(false)
  const [requesting, setRequesting] = useState(false)
  usePageTitle('Payouts')

  const accountsQuery = useQuery({
    queryKey: ['operator-payout-accounts', operatorId],
    queryFn: () => listPayoutAccounts(operatorId),
    enabled: Boolean(operatorId),
  })
  const payoutsQuery = useQuery({
    queryKey: ['operator-payouts', operatorId],
    queryFn: () => listPayoutRequests(operatorId),
    enabled: Boolean(operatorId),
  })
  const ledgerQuery = useQuery({
    queryKey: ['operator-transactions', operatorId],
    queryFn: () => listOperatorTransactions(operatorId),
    enabled: Boolean(operatorId),
  })

  const accounts = accountsQuery.data ?? []
  const payouts = payoutsQuery.data ?? []
  const ledger = ledgerQuery.data ?? []
  const defaultAccount = accounts.find((account) => account.is_default) ?? accounts[0]

  const balance = useMemo(() => {
    const credits = ledger.filter((entry) => entry.direction === 'credit').reduce((sum, entry) => sum + entry.amount, 0)
    const debits = ledger.filter((entry) => entry.direction === 'debit').reduce((sum, entry) => sum + entry.amount, 0)
    return Math.max(0, credits - debits)
  }, [ledger])
  const pending = payouts.filter((payout) => ['pending', 'approved', 'processing'].includes(payout.status)).reduce((sum, payout) => sum + payout.amount, 0)
  const available = Math.max(0, balance - pending)

  const openAccount = (account?: PayoutAccount) => {
    setEditingAccount(account ?? null)
    setAccountForm(account ? { bank_name: account.bank_name, account_name: account.account_name, account_number: account.account_number, is_default: account.is_default } : ACCOUNT_BLANK)
    setAccountOpen(true)
  }

  const saveAccount = async () => {
    if (!operatorId) return
    if (!accountForm.bank_name || accountForm.account_name.trim().length < 3 || !/^\d{10}$/.test(accountForm.account_number)) {
      toast.error('Check account details', 'Choose a bank, enter the account name and a 10-digit NUBAN number.')
      return
    }
    setSaving(true)
    try {
      await savePayoutAccount(operatorId, {
        bank_name: accountForm.bank_name,
        account_name: accountForm.account_name.trim(),
        account_number: accountForm.account_number,
        is_default: accountForm.is_default,
        ...(editingAccount ? { id: editingAccount.id } : {}),
      })
      await queryClient.invalidateQueries({ queryKey: ['operator-payout-accounts', operatorId] })
      toast.success(editingAccount ? 'Payout account updated' : 'Payout account added', 'Paystack recipient codes are created server-side before the first transfer.')
      setAccountOpen(false)
    } catch (error) {
      toast.error('Could not save account', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const submitPayout = async () => {
    if (!operatorId) return
    const value = Number(amount)
    if (!defaultAccount) {
      toast.error('Add a payout account first')
      return
    }
    if (!Number.isFinite(value) || value < SITE_FEES.minimumPayout) {
      toast.error('Amount below minimum', `The minimum payout is ${formatNaira(SITE_FEES.minimumPayout)}.`)
      return
    }
    if (value > available) {
      toast.error('Amount exceeds available balance', `You can request up to ${formatNaira(available)} right now.`)
      return
    }
    setRequesting(true)
    try {
      await requestPayout(operatorId, value, accountId || defaultAccount.id)
      await queryClient.invalidateQueries({ queryKey: ['operator-payouts', operatorId] })
      await queryClient.invalidateQueries({ queryKey: ['operator-transactions', operatorId] })
      toast.success('Payout requested', 'Finance reviews payouts before transferring to your bank account.')
      setPayoutOpen(false)
      setAmount('')
    } catch (error) {
      toast.error('Could not request payout', (error as Error).message)
    } finally {
      setRequesting(false)
    }
  }

  if (isLoading || accountsQuery.isLoading || payoutsQuery.isLoading) return <PageLoader label="Loading payouts" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settlement"
        title="Payouts"
        description="Request withdrawals of available earnings. Payouts are reviewed, then transferred to your verified bank account."
        actions={<Button onClick={() => setPayoutOpen(true)} disabled={!accounts.length}><Wallet className="h-4 w-4" /> Request payout</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl bg-midnight-950 p-5 text-white">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/40">Available to withdraw</p>
          <p className="mt-1.5 font-mono text-2xl font-medium text-lime">{formatNaira(available)}</p>
          <p className="mt-1 text-[9.5px] text-white/40">After pending payout requests</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Pending payouts</p>
          <p className="mt-2 font-mono text-xl font-medium text-amber-700">{formatNaira(pending)}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">{payouts.filter((payout) => ['pending', 'approved', 'processing'].includes(payout.status)).length} request(s) in progress</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Lifetime net earnings</p>
          <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{formatNaira(stats?.netEarnings ?? 0)}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Before completed payouts</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <SectionCard
          title="Payout accounts"
          description="Where your earnings are sent."
          action={<Button variant="outline" size="sm" onClick={() => openAccount()}><Plus className="h-3.5 w-3.5" /> Add</Button>}
        >
          {accounts.length ? (
            <div className="space-y-2.5">
              {accounts.map((account) => (
                <div key={account.id} className={`rounded-2xl border p-4 ${account.is_default ? 'border-lime-400/70 bg-lime/10' : 'border-midnight-900/[0.07] bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-midnight-800"><Landmark className="h-4 w-4" /></span>
                      <div>
                        <p className="text-[12px] font-semibold text-midnight-900">{account.bank_name}</p>
                        <p className="font-mono text-[10px] text-charcoal-500">{account.account_number.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}</p>
                        <p className="mt-0.5 text-[10px] text-muted">{account.account_name}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {account.is_default && <Badge tone="success"><CheckCircle2 className="h-2.5 w-2.5" /> Default</Badge>}
                      <button onClick={() => openAccount(account)} className="text-[10px] font-semibold text-lime-700 hover:underline">Edit</button>
                    </div>
                  </div>
                  {!account.recipient_code && <p className="mt-2.5 text-[9px] text-amber-700">Recipient code will be created on your first payout.</p>}
                </div>
              ))}
            </div>
          ) : (
            <TableEmpty title="No payout account" description="Add a Nigerian bank account before requesting your first payout." action={<Button size="sm" onClick={() => openAccount()}><Plus className="h-3.5 w-3.5" /> Add account</Button>} />
          )}
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-mint-50 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-600" />
            <p className="text-[9.5px] leading-relaxed text-charcoal-600">We verify the account name against your business details before the first payout. Mismatched accounts are rejected.</p>
          </div>
        </SectionCard>

        <SectionCard title="Payout history" description="Every withdrawal request and its status.">
          {payouts.length ? (
            <div className="divide-y divide-midnight-900/[0.06]">
              {payouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-mono text-[13px] font-medium text-midnight-900">{formatNaira(payout.amount)}</p>
                    <p className="text-[9.5px] text-muted">{formatDate(payout.requested_at, 'dd MMM yyyy · HH:mm')} · {payout.account?.bank_name ?? 'Bank account'}</p>
                    {payout.admin_notes && <p className="mt-0.5 text-[9px] text-red-500">{payout.admin_notes}</p>}
                  </div>
                  <PayoutStatusBadge status={payout.status} />
                </div>
              ))}
            </div>
          ) : (
            <TableEmpty title="No payout requests yet" description="Once you have available earnings, request a payout to your verified account." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: 'Minimum payout', text: formatNaira(SITE_FEES.minimumPayout), icon: Wallet },
          { title: 'Review window', text: '1–2 business days', icon: CreditCard },
          { title: 'Transfer time', text: 'Same day after approval', icon: Building2 },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4">
            <item.icon className="h-4 w-4 text-lime-700" />
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{item.title}</p>
            <p className="mt-0.5 font-mono text-[12px] font-medium text-midnight-900">{item.text}</p>
          </div>
        ))}
      </div>

      <InfoNote title="How settlement works" tone="info">
        Energy revenue is credited to your ledger when a booking is paid. Platform commission is deducted automatically.
        Payout requests debit your available balance once approved. Refunded bookings may reduce future availability.
      </InfoNote>

      <Modal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title={editingAccount ? 'Edit payout account' : 'Add payout account'}
        description="Use a bank account that matches your registered business name."
        footer={<><Button variant="outline" onClick={() => setAccountOpen(false)}>Cancel</Button><Button loading={saving} onClick={saveAccount}>{editingAccount ? 'Save account' : 'Add account'}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Bank" required>
            <Select value={accountForm.bank_name} onChange={(event) => setAccountForm({ ...accountForm, bank_name: event.target.value })}>
              <option value="">Choose your bank</option>
              {NIGERIAN_BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
            </Select>
          </Field>
          <Field label="Account name" required hint="Must match the name on your business registration.">
            <Input value={accountForm.account_name} onChange={(event) => setAccountForm({ ...accountForm, account_name: event.target.value })} placeholder="GreenDrive Mobility Ltd" />
          </Field>
          <Field label="Account number (NUBAN)" required>
            <Input inputMode="numeric" maxLength={10} value={accountForm.account_number} onChange={(event) => setAccountForm({ ...accountForm, account_number: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="0123456789" />
          </Field>
          <label className="flex items-center gap-2 text-[12px] text-charcoal-600">
            <input type="checkbox" checked={accountForm.is_default} onChange={(event) => setAccountForm({ ...accountForm, is_default: event.target.checked })} className="h-4 w-4 rounded border-midnight-900/20 text-lime focus:ring-lime" />
            Use this as my default payout account
          </label>
        </div>
      </Modal>

      <Modal
        open={payoutOpen}
        onClose={() => setPayoutOpen(false)}
        title="Request a payout"
        description="Funds are reviewed by finance before transfer. You will receive a notification when the status changes."
        footer={<><Button variant="outline" onClick={() => setPayoutOpen(false)}>Cancel</Button><Button loading={requesting} onClick={submitPayout}>Request payout</Button></>}
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-mint-50 p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Available</p>
            <p className="mt-1 font-mono text-2xl font-medium text-midnight-900">{formatNaira(available)}</p>
            <p className="mt-1 text-[9.5px] text-muted">Minimum {formatNaira(SITE_FEES.minimumPayout)} per request</p>
          </div>
          <Field label="Amount (₦)" required>
            <Input type="number" min={SITE_FEES.minimumPayout} max={available} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={String(SITE_FEES.minimumPayout)} />
          </Field>
          <Field label="Destination account" required>
            <Select value={accountId || defaultAccount?.id || ''} onChange={(event) => setAccountId(event.target.value)}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.bank_name} · {account.account_number} {account.is_default ? '(default)' : ''}</option>)}
            </Select>
          </Field>
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] leading-relaxed text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Double-check the destination account. Transfers cannot be reversed after approval.
          </div>
        </div>
      </Modal>
    </div>
  )
}

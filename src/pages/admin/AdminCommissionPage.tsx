import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgePercent, Calculator, Check, Pencil, Save, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import {
  listCommissionSettings,
  listPlans,
  updateCommissionSettings,
  updatePlan,
  writeAuditLog,
} from '@/services/admin'
import type { SubscriptionPlan } from '@/types'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { InfoNote } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatNaira, humanize } from '@/lib/utils'

export default function AdminCommissionPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ global_commission_percent: 15, service_fee_amount: 200, vat_percent: 7.5, minimum_payout_amount: 50000 })
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)
  const [planForm, setPlanForm] = useState({ price_monthly: 0, max_stations: 1, is_active: true })
  const [savingPlan, setSavingPlan] = useState(false)
  const [example, setExample] = useState(10000)
  usePageTitle('Platform commission')

  const settingsQuery = useQuery({ queryKey: ['admin-commission'], queryFn: listCommissionSettings })
  const plansQuery = useQuery({ queryKey: ['admin-plans'], queryFn: listPlans })

  useEffect(() => {
    if (!settingsQuery.data) return
    setForm({
      global_commission_percent: settingsQuery.data.global_commission_percent,
      service_fee_amount: settingsQuery.data.service_fee_amount,
      vat_percent: settingsQuery.data.vat_percent,
      minimum_payout_amount: settingsQuery.data.minimum_payout_amount,
    })
  }, [settingsQuery.data])

  const save = async () => {
    if (!settingsQuery.data) return
    if (form.global_commission_percent < 0 || form.global_commission_percent > 50) {
      toast.error('Commission out of range', 'Set a commission between 0% and 50%.')
      return
    }
    if (form.vat_percent < 0 || form.vat_percent > 30) {
      toast.error('VAT out of range', 'Set VAT between 0% and 30%.')
      return
    }
    setSaving(true)
    try {
      await updateCommissionSettings(settingsQuery.data.id, form)
      if (user) await writeAuditLog(user.id, 'settings.commission_updated', 'commission_settings', settingsQuery.data.id, { ...form })
      await queryClient.invalidateQueries({ queryKey: ['admin-commission'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success('Commission settings saved', 'New bookings will use these rates. Existing bookings keep their original pricing.')
    } catch (error) {
      toast.error('Could not save settings', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const openPlan = (item: SubscriptionPlan) => {
    setPlan(item)
    setPlanForm({ price_monthly: item.price_monthly, max_stations: item.max_stations, is_active: item.is_active })
  }

  const savePlan = async () => {
    if (!plan) return
    setSavingPlan(true)
    try {
      await updatePlan(plan.id, planForm)
      if (user) await writeAuditLog(user.id, 'settings.plan_updated', 'subscription_plan', plan.id, { ...planForm })
      await queryClient.invalidateQueries({ queryKey: ['admin-plans'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success('Plan updated', plan.name)
      setPlan(null)
    } catch (error) {
      toast.error('Could not update plan', (error as Error).message)
    } finally {
      setSavingPlan(false)
    }
  }

  if (settingsQuery.isLoading || plansQuery.isLoading) return <PageLoader label="Loading commission settings" />

  const settings = settingsQuery.data
  const plans = plansQuery.data ?? []
  if (!settings) return <InfoNote title="Commission settings missing" tone="warning">Seed the commission_settings table with a single active row.</InfoNote>

  const gross = example
  const commission = (gross * form.global_commission_percent) / 100
  const vat = (commission * form.vat_percent) / 100
  const operatorNet = gross - commission
  const platformNet = commission + form.service_fee_amount

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bookings & finance"
        title="Platform commission"
        description="The commercial rules that govern every booking. Changes apply to new bookings only and are written to the audit log."
        actions={<Button loading={saving} onClick={save}><Save className="h-4 w-4" /> Save settings</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <SectionCard title="Commission & fees" description="Applied server-side when a booking is created.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Global commission (%)" required hint="Platform share of the charging fee.">
              <Input type="number" min={0} max={50} step={0.5} value={form.global_commission_percent} onChange={(event) => setForm({ ...form, global_commission_percent: Number(event.target.value) })} />
            </Field>
            <Field label="Customer service fee (₦)" required hint="Flat fee added to the customer total.">
              <Input type="number" min={0} step={50} value={form.service_fee_amount} onChange={(event) => setForm({ ...form, service_fee_amount: Number(event.target.value) })} />
            </Field>
            <Field label="VAT (%)" required hint="Applied to the platform service components.">
              <Input type="number" min={0} max={30} step={0.5} value={form.vat_percent} onChange={(event) => setForm({ ...form, vat_percent: Number(event.target.value) })} />
            </Field>
            <Field label="Minimum payout (₦)" required hint="Operators cannot request less than this.">
              <Input type="number" min={0} step={5000} value={form.minimum_payout_amount} onChange={(event) => setForm({ ...form, minimum_payout_amount: Number(event.target.value) })} />
            </Field>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-[10.5px] leading-relaxed text-amber-800">
              Commission changes do not retroactively alter existing bookings or ledger entries. Coordinate with finance
              before changing rates, and notify operators in advance.
            </p>
          </div>

          <Button className="mt-4" loading={saving} onClick={save}><Save className="h-4 w-4" /> Save settings</Button>
        </SectionCard>

        <SectionCard title="Fee calculator" description="Model the split on a sample charging fee.">
          <div className="rounded-2xl bg-mint-50 p-4">
            <p className="text-[9.5px] uppercase tracking-[0.12em] text-muted">Customer charging fee</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-mono text-lg text-muted">₦</span>
              <input type="number" min={0} step={500} value={example} onChange={(event) => setExample(Number(event.target.value))} className="w-full bg-transparent font-mono text-2xl font-medium text-midnight-900 outline-none" />
            </div>
          </div>
          <div className="mt-3 space-y-2.5">
            {[
              { label: `Platform commission (${form.global_commission_percent}%)`, value: commission, tone: 'text-midnight-900' },
              { label: `VAT on commission (${form.vat_percent}%)`, value: vat, tone: 'text-charcoal-600' },
              { label: 'Operator net share', value: operatorNet, tone: 'text-emerald-700' },
              { label: 'Platform gross (commission + service fee)', value: platformNet, tone: 'text-midnight-900' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 border-b border-midnight-900/[0.06] pb-2.5 last:border-0">
                <span className="text-[10.5px] text-muted">{row.label}</span>
                <span className={`font-mono text-[12px] font-medium ${row.tone}`}>{formatNaira(Math.round(row.value))}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-midnight-950 px-3 py-2.5 text-white">
            <Calculator className="h-3.5 w-3.5 text-lime" />
            <span className="text-[9.5px] text-white/60">Customer total = charging fee + service fee + VAT</span>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Operator subscription plans" description="Plan limits are enforced when operators add stations.">
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map((item) => (
            <div key={item.id} className="rounded-3xl border border-midnight-900/[0.07] p-5">
              <div className="flex items-center justify-between">
                <Badge tone={item.tier === 'professional' ? 'lime' : 'neutral'}>{humanize(item.tier)}</Badge>
                <Badge tone={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'active' : 'hidden'}</Badge>
              </div>
              <p className="mt-3 font-display text-lg font-semibold text-midnight-900">{item.name}</p>
              <p className="mt-1 font-mono text-2xl font-medium text-midnight-900">{item.price_monthly ? formatNaira(item.price_monthly) : 'Free'}<span className="text-[10px] text-muted">{item.price_monthly ? '/month' : ''}</span></p>
              <p className="mt-1 text-[10px] text-muted">Up to {item.max_stations} stations</p>
              <ul className="mt-3 space-y-1.5">
                {item.features.slice(0, 4).map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5 text-[10px] text-charcoal-600"><Check className="mt-0.5 h-3 w-3 shrink-0 text-lime-600" /> {feature}</li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => openPlan(item)}><Pencil className="h-3.5 w-3.5" /> Edit plan</Button>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Current commission', value: `${settings.global_commission_percent}%`, icon: BadgePercent },
          { label: 'Service fee', value: formatNaira(settings.service_fee_amount), icon: Wallet },
          { label: 'Minimum payout', value: formatNaira(settings.minimum_payout_amount), icon: Sparkles },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4">
            <item.icon className="h-4 w-4 text-lime-700" />
            <p className="mt-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{item.label}</p>
            <p className="mt-0.5 font-mono text-base font-medium text-midnight-900">{item.value}</p>
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(plan)}
        onClose={() => setPlan(null)}
        title={`Edit ${plan?.name ?? 'plan'}`}
        description="Plan changes affect new subscriptions. Existing subscriptions keep their agreed terms until renewal."
        footer={<><Button variant="outline" onClick={() => setPlan(null)}>Cancel</Button><Button loading={savingPlan} onClick={savePlan}>Save plan</Button></>}
      >
        <div className="space-y-4">
          <Field label="Monthly price (₦)" required>
            <Input type="number" min={0} step={1000} value={planForm.price_monthly} onChange={(event) => setPlanForm({ ...planForm, price_monthly: Number(event.target.value) })} />
          </Field>
          <Field label="Maximum stations" required hint="Set 0 for unlimited stations.">
            <Input type="number" min={0} value={planForm.max_stations} onChange={(event) => setPlanForm({ ...planForm, max_stations: Number(event.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 text-[12px] text-charcoal-600">
            <input type="checkbox" checked={planForm.is_active} onChange={(event) => setPlanForm({ ...planForm, is_active: event.target.checked })} className="h-4 w-4 rounded border-midnight-900/20 text-lime focus:ring-lime" />
            Plan is available for new subscriptions
          </label>
        </div>
      </Modal>
    </div>
  )
}

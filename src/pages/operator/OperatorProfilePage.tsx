import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Building2,
  Check,
  Clock,
  FileCheck2,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldAlert,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import {
  listOperatorDocuments,
  listPayoutAccounts,
  updateOperatorProfile,
  uploadOperatorDocument,
} from '@/services/operator'
import { useAuth } from '@/contexts/AuthContext'
import type { DocumentType, OperatorDocument } from '@/types'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { InfoNote, TableEmpty } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatNaira } from '@/lib/utils'

const DOCUMENTS: { type: DocumentType; title: string; description: string; required: boolean }[] = [
  {
    type: 'business_registration',
    title: 'Business registration',
    description: 'CAC certificate or incorporation documents.',
    required: true,
  },
  {
    type: 'identification',
    title: 'Owner identification',
    description: 'National ID, driver licence or international passport.',
    required: true,
  },
  {
    type: 'proof_of_ownership',
    title: 'Proof of ownership',
    description: 'Lease, title deed or written permission to operate the site.',
    required: true,
  },
  {
    type: 'station_photo',
    title: 'Station photo',
    description: 'A clear photo of the installed charger and site entrance.',
    required: false,
  },
]

const DOC_STATUS: Record<OperatorDocument['status'], { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  verified: { tone: 'success', label: 'Verified' },
  pending: { tone: 'warning', label: 'In review' },
  rejected: { tone: 'danger', label: 'Rejected' },
}

export default function OperatorProfilePage() {
  const { operatorId, profile, isLoading } = useOperatorData()
  const { refreshProfile } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingType, setPendingType] = useState<DocumentType>('business_registration')
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    phone: '',
    business_address: '',
    business_registration_number: '',
    business_description: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  usePageTitle('Business profile')

  useEffect(() => {
    if (!profile) return
    setForm({
      business_name: profile.business_name,
      owner_name: profile.owner_name,
      phone: profile.phone,
      business_address: profile.business_address,
      business_registration_number: profile.business_registration_number ?? '',
      business_description: profile.business_description ?? '',
    })
  }, [profile])

  const documentsQuery = useQuery({
    queryKey: ['operator-documents', operatorId],
    queryFn: () => listOperatorDocuments(operatorId),
    enabled: Boolean(operatorId),
  })
  const accountsQuery = useQuery({
    queryKey: ['operator-payout-accounts', operatorId],
    queryFn: () => listPayoutAccounts(operatorId),
    enabled: Boolean(operatorId),
  })

  const documents = documentsQuery.data ?? []
  const accounts = accountsQuery.data ?? []
  const defaultAccount = accounts.find((account) => account.is_default) ?? accounts[0]
  const latestFor = (type: DocumentType) => documents.find((document) => document.document_type === type)
  const verifiedCount = DOCUMENTS.filter((document) => latestFor(document.type)?.status === 'verified').length
  const requiredMissing = DOCUMENTS.filter((document) => document.required && !latestFor(document.type)).length

  const startUpload = (type: DocumentType) => {
    setPendingType(type)
    fileRef.current?.click()
  }

  const handleFile = async (file: File | undefined) => {
    if (!file || !operatorId) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', 'Choose a PDF or image smaller than 10 MB.')
      return
    }
    setUploading(true)
    try {
      await uploadOperatorDocument(operatorId, file, pendingType)
      await queryClient.invalidateQueries({ queryKey: ['operator-documents', operatorId] })
      toast.success('Document uploaded', 'Our verification team will review it within 2 business days.')
    } catch (error) {
      toast.error('Could not upload document', (error as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (form.business_name.trim().length < 3) next.business_name = 'Enter your registered business name.'
    if (form.owner_name.trim().length < 3) next.owner_name = 'Enter the business owner or director name.'
    if (form.phone.trim().length < 7) next.phone = 'Enter a reachable business phone number.'
    if (form.business_address.trim().length < 8) next.business_address = 'Enter your registered business address.'
    if (form.business_registration_number && form.business_registration_number.trim().length < 5) {
      next.business_registration_number = 'Enter a valid CAC/RC number or leave it blank.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async () => {
    if (!operatorId) return
    if (!validate()) {
      toast.error('Check the highlighted fields', 'Some business details still need attention.')
      return
    }
    setSaving(true)
    try {
      await updateOperatorProfile(operatorId, {
        business_name: form.business_name.trim(),
        owner_name: form.owner_name.trim(),
        phone: form.phone.trim(),
        business_address: form.business_address.trim(),
        business_registration_number: form.business_registration_number.trim() || null,
        business_description: form.business_description.trim() || null,
      })
      await queryClient.invalidateQueries({ queryKey: ['operator-profile'] })
      await refreshProfile()
      toast.success('Profile saved', 'Your business details are up to date.')
    } catch (error) {
      toast.error('Could not save profile', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading profile" />

  if (!profile) {
    return (
      <InfoNote title="Operator profile not found" tone="warning">
        We could not find a business profile linked to your account. Contact support so we can repair the link.
      </InfoNote>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Business profile"
        description="Your legal business details, verification documents and payout destination. Keep these accurate for payouts and driver trust."
        actions={<Button loading={saving} onClick={save}><Save className="h-4 w-4" /> Save changes</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl bg-midnight-950 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime text-midnight-900"><Building2 className="h-5 w-5" /></span>
              <div>
                <p className="font-display text-lg font-semibold">{profile.business_name}</p>
                <p className="text-[10px] text-white/45">Operator since {formatDate(profile.created_at)}</p>
              </div>
            </div>
            <Badge tone={profile.status === 'approved' ? 'lime' : profile.status === 'pending' ? 'warning' : 'danger'}>
              {profile.status === 'approved' ? <BadgeCheck className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
              {profile.status}
            </Badge>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
            <div>
              <p className="font-mono text-lg font-medium text-lime">{verifiedCount}/{DOCUMENTS.length}</p>
              <p className="text-[9px] uppercase tracking-[0.12em] text-white/40">Docs verified</p>
            </div>
            <div>
              <p className="font-mono text-lg font-medium text-white">{requiredMissing}</p>
              <p className="text-[9px] uppercase tracking-[0.12em] text-white/40">Required missing</p>
            </div>
            <div>
              <p className="font-mono text-lg font-medium text-white">{accounts.length}</p>
              <p className="text-[9px] uppercase tracking-[0.12em] text-white/40">Bank accounts</p>
            </div>
          </div>

          {profile.status === 'rejected' && profile.rejection_reason && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/15 px-3 py-2.5 text-[10px] leading-relaxed text-red-200">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {profile.rejection_reason}
            </div>
          )}
          {profile.status === 'pending' && (
            <p className="mt-4 text-[10px] leading-relaxed text-white/45">
              Your account is in review. You can prepare stations now; they go live once the business and location are approved.
            </p>
          )}
        </div>

        <SectionCard title="Payout destination" description="Where approved earnings are transferred.">
          {defaultAccount ? (
            <>
              <div className="flex items-start gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-midnight-800"><Landmark className="h-4 w-4" /></span>
                <div>
                  <p className="text-[12px] font-semibold text-midnight-900">{defaultAccount.bank_name}</p>
                  <p className="font-mono text-[10px] text-charcoal-500">{defaultAccount.account_number}</p>
                  <p className="mt-0.5 text-[10px] text-muted">{defaultAccount.account_name}</p>
                </div>
              </div>
              <Link to="/operator/payouts" className="mt-4 inline-flex h-9 items-center justify-center rounded-xl border border-midnight-900/10 px-3 text-[10.5px] font-semibold text-charcoal-600 hover:bg-mint-50">
                Manage accounts
              </Link>
            </>
          ) : (
            <TableEmpty
              title="No payout account"
              description="Add a verified bank account before requesting payouts."
              action={<Link to="/operator/payouts" className="inline-flex h-9 items-center rounded-xl bg-midnight-900 px-3 text-[10.5px] font-semibold text-lime">Add account</Link>}
            />
          )}
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-mint-50 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-600" />
            <p className="text-[9.5px] leading-relaxed text-charcoal-600">The account name must match your registered business name to prevent payout delays.</p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <SectionCard title="Business details" description="Shown to our verification team and used for receipts.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Registered business name" required error={errors.business_name} className="sm:col-span-2">
              <Input value={form.business_name} onChange={(event) => setForm({ ...form, business_name: event.target.value })} placeholder="GreenDrive Mobility Ltd" />
            </Field>
            <Field label="Owner / director" required error={errors.owner_name}>
              <Input value={form.owner_name} onChange={(event) => setForm({ ...form, owner_name: event.target.value })} placeholder="Emeka Okafor" />
            </Field>
            <Field label="Business phone" required error={errors.phone}>
              <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+234 800 000 0000" />
            </Field>
            <Field label="Business email" hint="Contact support to change your sign-in email.">
              <Input value={profile.email} readOnly disabled />
            </Field>
            <Field label="CAC / RC number" error={errors.business_registration_number}>
              <Input value={form.business_registration_number} onChange={(event) => setForm({ ...form, business_registration_number: event.target.value })} placeholder="RC 1234567" />
            </Field>
            <Field label="Registered business address" required error={errors.business_address} className="sm:col-span-2">
              <Input value={form.business_address} onChange={(event) => setForm({ ...form, business_address: event.target.value })} placeholder="14 Adeola Odeku Street, Victoria Island, Lagos" />
            </Field>
            <Field label="About your business" className="sm:col-span-2" hint="Optional. Tell drivers about your network and operating experience.">
              <Textarea rows={3} value={form.business_description} onChange={(event) => setForm({ ...form, business_description: event.target.value })} placeholder="We operate reliable fast-charging hubs across Lagos…" />
            </Field>
          </div>

          <div className="mt-4 grid gap-2 rounded-2xl bg-mint-50 p-4 sm:grid-cols-3">
            {[
              { icon: Mail, label: 'Email', value: profile.email },
              { icon: Phone, label: 'Phone', value: profile.phone },
              { icon: MapPin, label: 'Address', value: profile.business_address },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                <item.icon className="mt-0.5 h-3 w-3 shrink-0 text-midnight-700" />
                <div>
                  <p className="text-[8.5px] uppercase tracking-[0.12em] text-muted">{item.label}</p>
                  <p className="text-[10px] leading-snug text-charcoal-600">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <Button className="mt-4" loading={saving} onClick={save}><Save className="h-4 w-4" /> Save changes</Button>
        </SectionCard>

        <SectionCard
          title="Verification documents"
          description="PDF or image, up to 10 MB each."
          action={<Badge tone={requiredMissing ? 'warning' : 'success'}>{requiredMissing ? `${requiredMissing} required` : 'Submitted'}</Badge>}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <div className="space-y-2.5">
            {DOCUMENTS.map((document) => {
              const latest = latestFor(document.type)
              const status = latest ? DOC_STATUS[latest.status] : null
              return (
                <div key={document.type} className="rounded-2xl border border-midnight-900/[0.07] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${latest?.status === 'verified' ? 'bg-lime/25 text-midnight-800' : 'bg-charcoal-50 text-charcoal-400'}`}>
                        {latest?.status === 'verified' ? <FileCheck2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[11.5px] font-semibold text-midnight-900">{document.title}</p>
                          {document.required && !latest && <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-red-500">Required</span>}
                          {status && <Badge tone={status.tone}>{status.label}</Badge>}
                        </div>
                        <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted">{latest ? latest.file_name : document.description}</p>
                        {latest && <p className="mt-0.5 font-mono text-[8.5px] text-muted">Uploaded {formatDate(latest.created_at)}</p>}
                        {latest?.status === 'rejected' && latest.notes && <p className="mt-1 text-[9px] text-red-500">{latest.notes}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => startUpload(document.type)}
                      disabled={uploading}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50 disabled:opacity-50"
                    >
                      {latest ? <Upload className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
                      {latest ? 'Replace' : 'Upload'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
            <p className="text-[9.5px] leading-relaxed text-amber-800">
              Verification takes up to 2 business days. Rejected documents can be replaced immediately.
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Account checklist" description="Everything needed to receive bookings and payouts.">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Business profile complete', done: Boolean(form.business_name && form.owner_name && form.phone && form.business_address), icon: Building2 },
            { label: 'Account approved', done: profile.status === 'approved', icon: Check },
            { label: 'Required documents submitted', done: requiredMissing === 0, icon: FileCheck2 },
            { label: 'Payout account added', done: accounts.length > 0, icon: Landmark },
          ].map((item) => (
            <div key={item.label} className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3 ${item.done ? 'bg-lime/12' : 'bg-charcoal-50'}`}>
              <span className={`grid h-6 w-6 place-items-center rounded-full ${item.done ? 'bg-lime text-midnight-900' : 'bg-white text-charcoal-300'}`}>
                {item.done ? <Check className="h-3 w-3" /> : <item.icon className="h-3 w-3" />}
              </span>
              <p className={`text-[10.5px] font-medium ${item.done ? 'text-midnight-900' : 'text-charcoal-500'}`}>{item.label}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <User className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Need to change your sign-in email or legal entity? Open a support ticket. Some changes require re-verification
          before payouts continue. Current minimum payout is {formatNaira(50000)}.
        </p>
      </div>
    </div>
  )
}

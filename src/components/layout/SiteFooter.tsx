import { ArrowUpRight, Instagram, Linkedin, Mail, MapPin, Phone, Twitter } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Brand'
import { BRAND, LEGAL_ENTITY } from '@/lib/constants'
import { LEGAL_DOC_LINKS } from '@/lib/legal'
import { usePlatformContent } from '@/hooks/usePlatformContent'

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'Find charging stations', to: '/stations' },
      { label: 'Find EV mechanics', to: '/mechanics' },
      { label: 'Become a mechanic partner', to: '/register/mechanic' },
      { label: 'Manage a booking', to: '/manage-booking' },
      { label: 'How it works', to: '/how-it-works' },
      { label: 'For station owners', to: '/for-operators' },
      { label: 'Fees & refunds', to: '/legal/refunds' },
      { label: 'Coverage', to: '/#coverage' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About EV Naija', to: '/about' },
      { label: 'Contact us', to: '/contact' },
      { label: 'Partner with us', to: '/for-operators' },
      { label: 'Support centre', to: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      ...LEGAL_DOC_LINKS.map((doc) => ({ label: doc.label, to: `/legal/${doc.slug}` })),
    ],
  },
]

export function SiteFooter() {
  const content = usePlatformContent()
  return (
    <footer className="relative overflow-hidden bg-midnight-950 text-white">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-lime/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.04]" />

      <div className="container-page relative py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_2fr]">
          <div>
            <Logo variant="light" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/45">{content.footerTagline}</p>
            <div className="mt-6 space-y-2.5 text-sm text-white/55">
              <a href={`mailto:${content.supportEmail}`} className="flex items-center gap-2.5 transition hover:text-lime">
                <Mail className="h-4 w-4 text-white/30" /> {content.supportEmail}
              </a>
              <a href={`tel:${content.supportPhone.replace(/\s/g, '')}`} className="flex items-center gap-2.5 transition hover:text-lime">
                <Phone className="h-4 w-4 text-white/30" /> {content.supportPhone}
              </a>
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/30" /> {BRAND.address}
              </p>
            </div>
            <div className="mt-7 flex items-center gap-2">
              {[
                { icon: Instagram, label: 'Instagram', href: content.instagram },
                { icon: Twitter, label: 'X (Twitter)', href: content.x },
                { icon: Linkedin, label: 'LinkedIn', href: content.linkedin },
              ]
                .filter((item) => Boolean(item.href))
                .map(({ icon: Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/50 transition hover:border-lime/40 hover:bg-lime/10 hover:text-lime"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">{column.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className="text-sm text-white/60 transition hover:text-lime">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} {LEGAL_ENTITY.name}. All rights reserved.
            {LEGAL_ENTITY.registrationNumber ? ` ${LEGAL_ENTITY.registrationNumber}.` : ''}
          </p>
          <div className="flex items-center gap-4 text-xs text-white/35">
            <span>Made for Nigeria’s electric future</span>
            <span className="h-1 w-1 rounded-full bg-lime" />
            <Link to="/for-operators" className="inline-flex items-center gap-1 text-lime/80 hover:text-lime">
              Become a partner <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

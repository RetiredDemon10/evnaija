# EV Naija — Brand System

> **Power Your Journey. Charge Without Limits.**

This document is the single source of truth for the EV Naija visual and verbal
identity. Tokens live in [`tailwind.config.ts`](../tailwind.config.ts); the
typefaces live in [`public/fonts`](../public/fonts) and are declared in
[`src/styles/fonts.css`](../src/styles/fonts.css).

---

## 1. Brand idea

EV Naija is the trusted marketplace for electric-vehicle charging in Nigeria —
verified stations, transparent naira pricing, and reservations you can rely on,
from Lagos to Abuja and Port Harcourt.

| Attribute | We are | We are not |
| --- | --- | --- |
| Tone | Confident, clear, warm | Corporate, bureaucratic |
| Energy | Electric, forward-looking | Loud, gimmicky |
| Trust | Verified, transparent | Hype, fake stats |
| Place | Proudly Nigerian, pan-African | Generic global tech |

**Voice:** short sentences, plain English, naira-first. We say *"Reserve your
charger"*, not *"Utilise our reservation subsystem"*. We never invent reviews,
prices, or live availability — honesty is part of the brand.

---

## 2. The mark

- **Symbol:** the **charge bolt** inside a rounded square — motion, energy, and
  electricity in one glyph. Defined in [`BoltMark`](../src/components/ui/Brand.tsx)
  and reused as [`favicon.svg`](../public/favicon.svg).
- **Lockup:** the supplied wordmark (`/ev-naija-logo.png`) is the primary logo.
  If the raster fails to load, the `Logo` component falls back to a live
  bolt + wordmark set in the display typeface, so the brand never disappears.
- **Social card:** `public/og-image.jpg` (1200×630) is generated from
  `public/og-image.svg`; update both when the tagline changes. Set an absolute
  `og:image` URL at deploy time for the widest crawler support.
- **Clear space:** keep at least the height of the bolt clear on all sides.
- **Minimum size:** 32 px tall for the symbol, 96 px wide for the full lockup.
- **Don'ts:** do not recolour the bolt, stretch the lockup, add shadows, or
  place the dark wordmark on a dark surface (use the `light` variant).

---

## 3. Colour

An electric lime charge against deep midnight teal — high energy, high trust.

| Token | Hex | Role |
| --- | --- | --- |
| `midnight.900` | `#071B22` | Primary dark surface, headers, footers |
| `midnight.950` | `#041217` | Deepest background, hero |
| `lime.300` (brand) | `#C6F36A` | Accent, CTAs, active states, focus |
| `lime.500` | `#8BC521` | Accessible lime on light surfaces |
| `mint.100` | `#EAF5EA` | Page background (light mode) |
| `charcoal.900` | `#17272B` | Body text |
| `muted` | `#829194` | Secondary text, labels |

**Pairings**
- Lime `#C6F36A` is only used on `midnight`/`charcoal` or with `midnight` text —
  never lime text on white.
- Use `lime.500` for lime text/icons on light backgrounds (WCAG AA).
- One accent per view. Lime is the signal, not the wallpaper.

---

## 4. Typography

Three self-hosted, distinctive families give EV Naija a voice that generic
system fonts cannot. Self-hosting also keeps the CSP strict
(`font-src 'self' data:`) and removes third-party requests.

| Role | Family | Weights | Used for |
| --- | --- | --- | --- |
| **Display** | **Bricolage Grotesque** | 200–800 | Headlines, section titles, numerals in hero stats |
| **Body** | **Onest** | 100–900 | Paragraphs, UI copy, form fields, tables |
| **Mono** | **JetBrains Mono** | 100–800 | Prices, eyebrows, codes, timestamps, chart axes |

**Rules**
- Headings use `font-display` with negative tracking (`tracking-[-0.03em]`).
- Prices, IDs, and figures use `font-mono` for a precise, technical feel.
- Body copy is never set in the display face below 18 px.
- Refetch fonts with `node scripts/fetch-fonts.mjs` (latin + latin-ext, so
  Yoruba/Igbo diacritics such as ẹ, ọ, ṣ, ị, ụ render correctly).

---

## 5. Shape, depth & motion

- **Radii:** `rounded-xl` (controls), `rounded-3xl` (cards), `rounded-[32px]` (hero panels).
- **Elevation:** `shadow-card` at rest, `shadow-float` on hover/active.
- **Motion:** short, purposeful, spring-eased. Reveals stagger at 80 ms, cards
  lift 6 px on hover, the nav underline slides between items. Everything honours
  `prefers-reduced-motion` (see [`src/lib/motion.ts`](../src/lib/motion.ts)).
- **Hero film:** the homepage hero plays a two-clip, self-hosted sequence
  (`public/videos/hero-arrive.mp4` → `hero-charge.mp4`, 960×540, 8 s each) that
  tells the story *arrive → charge* with a 1 s cross-fade. Clips are muted,
  `playsInline`, and `object-cover` under the existing dark gradients so text
  stays legible. `HeroVideo` falls back to `public/videos/hero-poster.jpg` when
  the visitor prefers reduced motion, has Save-Data on, or playback errors.
  Source footage is Mixkit (free licence, no attribution); re-encode with
  `avconvert` and keep each clip under ~1 MB.

---

## 6. Applying the brand

- Colours: use Tailwind tokens (`bg-midnight-900`, `text-lime`, …). No raw hex in components.
- Fonts: use `font-display` / `font-sans` / `font-mono` utilities.
- Logo: always via the `Logo` component so the fallback and hover behave.
- New surfaces should pass the test: *does it read as calm, electric, and honest?*

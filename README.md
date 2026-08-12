# SATX Ritas Rental Service

A Next.js application for renting frozen drink machines in San Antonio, TX. It
covers two verticals: event rentals booked through a five-step wizard, and
long-term commercial leases captured as inquiries.

**There is no online payment.** The checkout persists a booking and sends
confirmations; the customer is invoiced out of band afterwards. An earlier
PayPal integration was removed — only `Rental.paypalOrderId` survives, for
historical documents.

## Features

- 📱 Five-step rental booking wizard (date → machine → details → extras → review)
  with drafts persisted to `localStorage`
- 🍹 Three machine sizes (15L, 30L, 45L) with per-type inventory and live
  availability checks
- 🏢 Long-term lease tiers with an inquiry form, priced from admin settings
- 🗺️ Static landing pages for each service area, driven by one shared list
- 🔒 Admin dashboard for orders, contacts, lease inquiries, blackout dates and
  runtime settings
- 📧 Email via Resend and SMS via Twilio on every booking, contact and inquiry
- 📊 Two independent analytics pipelines: first-party fingerprinting in MongoDB,
  and GA4 via gtag
- 🌙 Dark/light theme with system preference detection

## Tech Stack

- [Next.js 16](https://nextjs.org/) — App Router
- [React 19](https://react.dev/) · [TypeScript 5](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/) — theme lives in an `@theme` block
  in `src/app/globals.css`; there is no `tailwind.config.ts`
- [MongoDB](https://www.mongodb.com/) via [Mongoose 9](https://mongoosejs.com/)
- [NextAuth.js v4](https://next-auth.js.org/) — credentials provider, JWT sessions
- [Zod](https://zod.dev/) — request-body validation on every write route
- [Resend](https://resend.com/) — transactional email
- [Twilio](https://www.twilio.com/) — SMS notifications
- [Google Analytics 4](https://analytics.google.com/) — via gtag only
- [ThumbmarkJS](https://github.com/thumbmarkjs/thumbmarkjs) — first-party
  fingerprinting

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.sample` to `.env.local` and fill it in. `MONGODB_URI` and
   `MONGODB_DB` are required — `src/lib/mongodb.ts` throws at import without
   them. See **Environment Variables** below.
4. `npm run dev`

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
npm run dev           # Dev server (Turbopack)
npm run build         # Production build — also type-checks
npm run typecheck     # tsc --noEmit
npm run lint          # eslint .
npm run format        # Prettier, writes in place
npm run format:check  # Prettier, verify only
npm test              # Jest
npm run test:ci       # Jest with coverage thresholds (what CI runs)
```

`.github/workflows/ci.yml` runs typecheck, lint, format:check, test:ci and build
on every push and PR to `main`.

## Environment Variables

`.env.sample` is the authoritative list. In brief:

| Variable                                                                              | Notes                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `MONGODB_URI`, `MONGODB_DB`                                                           | Required; read at import time                                       |
| `ADMIN_USERNAME`                                                                      | Admin login                                                         |
| `ADMIN_PASSWORD_HASH`                                                                 | bcrypt hash — preferred                                             |
| `ADMIN_PASSWORD`                                                                      | Legacy plaintext fallback; warns loudly. Prefer the hash            |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL`                                                     | NextAuth session signing                                            |
| `RESEND_API_KEY`                                                                      | Email. Unset disables email, booking still succeeds                 |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `USER_PHONE_NUMBER` | SMS                                                                 |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GTM_ID`                                 | Production only                                                     |
| `NEXT_PUBLIC_GOOGLE_REVIEW_URL`                                                       | Optional; unset hides the review CTA                                |
| `CRON_SECRET`                                                                         | Guards `/api/cron/release-holds`; the route fails closed without it |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                  | Optional shared rate-limit store; falls back to per-instance memory |

Generate a password hash with:

```bash
node -e "console.log(require('bcrypt').hashSync(process.argv[1], 12))" 'your-password'
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── admin/          # Auth-required: orders, contacts, lease-inquiries,
│   │   │                   # blackout-dates, settings, analytics
│   │   ├── v1/             # Public: availability, contacts, lease-inquiries,
│   │   │                   # settings, reviews, analytics/fingerprint
│   │   ├── save-booking/   # Public checkout
│   │   ├── cron/           # release-holds (Vercel cron)
│   │   └── auth/           # NextAuth
│   ├── admin/              # Admin dashboard pages
│   ├── service-area/[city] # Statically generated area landing pages
│   ├── order/              # Rental wizard
│   ├── long-term-lease/    # Lease tiers and inquiry form
│   └── …                   # about, contact, faq, pricing, success
├── components/
│   ├── admin/              # Dashboard tables and modals
│   ├── order/steps/        # The five wizard steps
│   ├── lease/ · contact/ · home/
│   └── FingerprintTracker.tsx · OrderFormTracker.tsx · GoogleAnalytics.tsx
├── lib/
│   ├── pricing.ts          # calculatePrice — the per-day price primitive
│   ├── extras-catalog.ts   # Authoritative add-on and mixer pricing
│   ├── inventory.ts        # isMachineAvailable — every availability decision
│   ├── validation.ts       # Zod schemas, MACHINE_CAPACITY, escapeHtml
│   ├── api-guard.ts        # guardPublicWrite: rate limit + body cap
│   ├── auth.ts · mongodb.ts · dates.ts · analytics.ts · consent.ts
│   └── service-areas.ts · lease-data.ts · rental-data.ts · reviews.ts
├── models/                 # rental, contact, leaseInquiry, blackout-date,
│                           # settings, thumbprint
├── proxy.ts                # Next 16's middleware convention: admin auth + HTTPS
└── types/
```

## API Routes

**Public**

- `POST /api/save-booking` — the checkout. Persists a `Rental` as
  `pending_payment`, then emails and texts. Never trusts the body for money:
  `capacity` is derived from `machineType`, extras are re-priced from the
  catalog, and `price` comes from the server-side total.
- `GET /api/v1/availability` — thin wrapper over `isMachineAvailable`
- `POST /api/v1/contacts` · `POST /api/v1/lease-inquiries`
- `POST /api/v1/analytics/fingerprint`
- `GET /api/v1/settings` — whitelisted runtime overrides
- `GET /api/v1/reviews` — proxy for the shared review feed

All four public write routes go through `guardPublicWrite()` (per-IP rate limit
and body-size cap) before the body is parsed.

**Admin** (session required, enforced in `src/proxy.ts` and again per route)

- `GET|POST /api/admin/orders` · `GET|PUT|DELETE /api/admin/orders/[id]`
- `GET|POST /api/admin/contacts` · `GET|PATCH|DELETE /api/admin/contacts/[id]`
- `GET|POST /api/admin/lease-inquiries` · `…/[id]`
- `GET|POST /api/admin/blackout-dates` · `DELETE …/[id]`
- `GET|PUT /api/admin/settings`
- `GET /api/admin/analytics`

**Cron**

- `GET /api/cron/release-holds` — cancels stale `pending` holds

## Key Components

- `OrderForm` — owns wizard state, the draft, settings overrides and `price`
- `MachineStep` — checks all three machine types in parallel and greys out
  whatever is unavailable
- `ExtrasStep` · `ReviewStep` · `DateSelectionStep` · `DetailsStep`
- `PricingSummary` — renders `computeOrderTotal`, the single source of totals
- `LeaseInquiryForm` · `LeaseTierCard`
- `OrdersTable` · `EditOrderModal` · `CreateOrderModal` · `BlackoutDateForm`
- `FingerprintTracker` · `OrderFormTracker` — first-party analytics, both
  suppressed when the visitor has opted out
- `CookieConsent` — Consent Mode v2 opt-out
- `ThemeToggle` · `Navigation` · `Footer` · `MapSection`

## Deployment

Optimised for [Vercel](https://vercel.com):

1. Push to a Git repository
2. Import the project
3. Configure the environment variables above
4. Deploy

`vercel.json` registers the `release-holds` cron. Security headers and the CSP
are set in `next.config.ts` — **any new third-party script, iframe, font or
fetch target needs a CSP edit**, or it fails silently in the browser.

## Further Reading

- `CLAUDE.md` — architecture notes and the reasoning behind the non-obvious
  invariants (pricing, availability, the booking lifecycle, the CSP)
- `docs/security.md` — security headers and CSP
- `docs/auth-implementation.md` — admin authentication

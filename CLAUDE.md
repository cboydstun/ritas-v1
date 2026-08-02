# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier (writes in place)
npm test             # Jest (all tests)
npm run test:watch   # Jest watch mode
npm run test:machine # Run only machine-step tests
npm run test:coverage # Jest with coverage report
npm run test:ci      # Jest in CI mode with coverage
```

Run a single test file: `npx jest src/components/order/steps/__tests__/SomeTest.test.tsx`

Tests are co-located in `__tests__/` folders next to the code they cover. Jest is configured via `next/jest` with `jest-environment-jsdom`. The path alias `@/*` resolves to `src/*` (set in both `tsconfig.json` and `jest.config.js`). Test scripts pass `--passWithNoTests`, so a filter that matches nothing exits 0 — check the reported test count, don't trust a green exit alone.

`next.config.ts` sets `typescript.ignoreBuildErrors: true`, so **`npm run build` does not fail on type errors**. Run `npx tsc --noEmit` to actually typecheck.

`npm run lint` calls `eslint .` directly (`next lint` is removed in Next 16). `eslint.config.mjs` must keep its `ignores` entry for `.next/` — without it ESLint walks the build output and reports thousands of bogus errors in minified chunks.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript 5 · MongoDB/Mongoose · NextAuth.js v4 · Zod · Tailwind CSS 3

## Architecture

### Routing & Pages

`src/app/` uses the Next.js App Router. Public pages live at the root (`/order`, `/pricing`, `/long-term-lease`, etc.). Admin pages are under `src/app/admin/` and are protected by middleware. API routes are split between `src/app/api/v1/` (public) and `src/app/api/admin/` (auth-required). `/api/save-booking` (the public checkout) and `/api/cron/release-holds` sit outside both namespaces at `src/app/api/`.

Two customer-facing verticals share this codebase: **event rentals** (the `/order` wizard, `Rental` model) and **long-term commercial leases** (`/long-term-lease`, an inquiry form only — no payment, `LeaseInquiry` model).

### Multi-Step Order Form

The order flow (`/order`) is a single client component `src/components/order/OrderForm.tsx` that manages a 5-step wizard: date → machine → details → extras → review. Each step is lazy-loaded via `next/dynamic`. Form state is persisted to `localStorage` under key `satx-ritas-order-draft` so drafts survive page reloads. On mount, the form fetches `/api/v1/settings` to get dynamic overrides (mixer options, delivery window hours, pricing). The `StepProps` interface in `src/components/order/types.ts` is the contract between the parent form and each step component.

### Pricing

The single source of truth for all order totals is `computeOrderTotal()` in `src/components/order/utils.ts`. It wraps `calculatePrice()` from `src/lib/pricing.ts` and adds multi-day, extras, and discount logic:

- `perDayRate = basePrice + mixerPrice`
- `rentalDays = calculateRentalDays(rentalDate, returnDate)` — diffs **UTC** calendar dates, minimum 1. Do not reintroduce a millisecond diff of local-midnight `Date`s: a DST fall-back day is 25 hours, which billed one night as two.
- `subtotal = perDayRate × rentalDays + deliveryFee + extrasTotal` (machine rate is per-day; delivery is flat; each extra is per-day unless its catalog entry says `pricingType: "flat"`)
- `serviceDiscountAmount = subtotal × discountRate` — **retired**. No UI sets it and no server route accepts it from a request body; the field survives only for legacy bookings.
- `discountedSubtotal = subtotal − serviceDiscountAmount`

- `processingFee = discountedSubtotal × processingFeeRate`
- `salesTax = (discountedSubtotal + processingFee) × salesTaxRate` — the processing fee is a taxable line item, matching the QuickBooks invoice
- `finalTotal = discountedSubtotal + processingFee + salesTax`

Extras prices always come from `buildExtrasCatalog()` in `src/lib/extras-catalog.ts` (the static items in `types.ts` plus one `mixer-*` entry per flavour, with admin overrides folded in). `computeOrderTotal` looks each `selectedExtras[].id` up there and **ignores any `price`/`pricingType` on the item itself** — those may have arrived in a request body. Any UI that renders extras line items must use the same catalog, or the lines will not sum to the total.

Default constants: delivery $20, sales tax 8.25%, processing 3%. Base machine prices come from `src/lib/rental-data.ts`. The `PricingOverrides` type in `src/lib/pricing.ts` and `SettingsOverrides` in `utils.ts` allow the admin `Settings` document to override any of these at runtime.

### Availability & Inventory

`isMachineAvailable()` in `src/lib/inventory.ts` is the single source of truth for "can this machine be booked". `GET /api/v1/availability?machineType=&capacity=&date=&returnDate=` is a thin validating wrapper over it (`returnDate` optional, defaults to `date`). The algorithm:

1. Expand `[rentalDate, returnDate]` into every `YYYY-MM-DD` day in range.
2. Reject if any day falls in a `BlackoutDate` range (`isDateBlackedOut`).
3. Look up the per-type unit count via `getMachineInventory()` — reads `Settings.machines[type].inventory`; reject outright if `0`.
4. Count overlapping `Rental` docs **per day** (statuses `pending`, `pending_payment`, `confirmed`, `in-progress`); reject if any single day has `booked >= inventory`.

So a machine type is bookable while units remain, not simply because one rental exists. `DEFAULT_INVENTORY` in `inventory.ts` matches the `Settings` schema defaults (`single: 3, double: 3, triple: 2`) and applies only when no Settings document or configured value exists — keep the two in sync.

`isMachineAvailable` accepts an `excludeRentalId` option so a booking is not blocked by its own hold. `/api/save-booking` uses it to re-check after the write and roll back on oversell, which closes the check-then-write race on the last unit.

Because `pending` and `pending_payment` count against inventory, unpaid holds must expire. `releaseStaleHolds()` cancels them after `STALE_HOLD_MINUTES` (120); it runs from the `/api/cron/release-holds` Vercel cron (see `vercel.json`, guarded by `CRON_SECRET`) and again at the top of `/api/save-booking` as a safety net.

`MachineStep.tsx` checks all three machine types **in parallel** on mount so every card shows live availability, greys out unavailable ones, and auto-switches the selection to another available type (priority `triple > double > single`) when the current pick is unavailable. `useAvailabilityCheck` (`src/hooks/useAvailabilityCheck.ts`) wraps the single-type fetch.

Admins manage blackout date ranges via `/admin/blackout-dates` → `GET/POST /api/admin/blackout-dates` and `DELETE /api/admin/blackout-dates/[id]`.

### Long-Term Lease Flow

`/long-term-lease` renders three tiers (`single-15`, `double-30`, `triple-45`) via `LeaseTierCard.tsx`. Baseline tier data lives in `src/lib/lease-data.ts` (`leaseTiers`); `mergeLeaseTiers(overrides)` shallow-merges the admin `Settings.leaseTiers` overrides on top, so pricing/specs are editable at runtime without a deploy. `LeaseInquiryForm.tsx` posts to `POST /api/v1/lease-inquiries` (stored in the `LeaseInquiry` model, `src/models/leaseInquiry.ts`); admins triage them at `/admin/lease-inquiries` → `GET /api/admin/lease-inquiries`, `PATCH/DELETE /api/admin/lease-inquiries/[id]`. `LEASE_BUSINESS_TYPES` and `LEASE_TERMS` in `lease-data.ts` are the form's dropdown sources.

### Database

MongoDB via Mongoose. Connection is cached in `src/lib/mongodb.ts` using a global variable to avoid creating new connections on every serverless invocation. Models live in `src/models/`: `rental.ts`, `thumbprint.ts`, `contact.ts`, `blackout-date.ts`, `settings.ts`, `leaseInquiry.ts`. Every model uses the `mongoose.models.X || mongoose.model(...)` guard — keep that pattern or hot reload throws `OverwriteModelError`.

### Authentication (Admin)

NextAuth.js credentials provider with JWT session strategy (no database sessions). Config is in `src/lib/auth.ts`. The username comes from `ADMIN_USERNAME`; the password is checked against the bcrypt hash in `ADMIN_PASSWORD_HASH`, falling back (with a warning) to plaintext `ADMIN_PASSWORD` if the hash is unset. Both comparisons are constant-time and the credentials callback is IP rate-limited. Auth is enforced in two layers: `src/middleware.ts` uses `getToken()` to reject unauthenticated requests early — it requires both a token and `token.role === "admin"` (page requests redirect to `/admin/login`, API requests return 401) — and individual admin route handlers redundantly call `getServerSession(authOptions)` as defense-in-depth. The middleware also force-redirects HTTP→HTTPS in production via `x-forwarded-proto`, using the host from `SITE_URL` rather than the `Host` header (trusting the header made it an open redirect). Its matcher is scoped to `/admin/*` and `/api/admin/*` — widen it if `PERMANENT_REDIRECTS` ever gains a public-page entry.

### Checkout Flow

There is **no online payment**. `ReviewStep.tsx` posts to `POST /api/save-booking`, which is the public customer checkout endpoint (unauthenticated by design). It generates a `bookingId` via nanoid, persists a `Rental` with status `pending_payment`, and sends confirmation via Resend email + Twilio SMS. The customer is invoiced afterwards out-of-band.

The PayPal integration was removed — the component had no importers and its routes charged nobody. Only `Rental.paypalOrderId` and the `pending` status value remain, for historical documents.

`/api/save-booking` never trusts the request body for money:

- The body is parsed by `rentalDataSchema` (`src/lib/validation.ts`); unknown fields are stripped.
- `capacity` is **derived** from `machineType`, never read from the request.
- `selectedExtras` is re-resolved through `resolveSelectedExtras()` (`src/lib/extras-catalog.ts`); only `id` and `quantity` are honoured, prices come from the catalog, and unknown ids are a 400.
- `price` and `payment.amount` are both set from the server-side `computeOrderTotal`.
- `isServiceDiscount` is hard-coded `false`.

### Public API Hardening

All four public write routes (`/api/save-booking`, `/api/v1/contacts`, `/api/v1/lease-inquiries`, `/api/v1/analytics/fingerprint`) go through `guardPublicWrite()` in `src/lib/api-guard.ts`, which applies a per-IP fixed-window rate limit and a body-size cap before parsing JSON. The limiter (`src/lib/rate-limit.ts`) uses Upstash Redis when `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set and falls back to per-instance memory otherwise. Each route then parses through a zod schema and builds its Mongo document from an explicit field list — never `Model.create(body)`.

Customer-supplied strings interpolated into notification email must go through `escapeHtml()` from `src/lib/validation.ts`.

### Notifications

Triggered after a booking, contact submission, or lease inquiry: SMS via Twilio (`TWILIO_*` env vars) and email via Resend (`RESEND_API_KEY`). Escape every customer-supplied value with `escapeHtml()` before interpolating it into an email body.

### Admin Settings Override

The `Settings` model (`src/models/settings.ts`) stores **one singleton document keyed `{ key: "global" }`** — always query it with that filter. It holds runtime overrides for:

- `fees` — `deliveryFee`, `salesTaxRate`, `processingFeeRate`, `serviceDiscountRate`
- `machines.{single,double,triple}` — `basePrice` **and** `inventory` (drives availability, see above)
- `mixers` / `extras` / `leaseTiers` — `Schema.Types.Mixed` maps with schema-level defaults
- `operations` — `deliveryWindowStartHour` / `EndHour`, guarded by a `pre("validate")` hook requiring end > start
- `documentation` — lease PDF URL/label

`GET /api/v1/settings` is public and returns only these whitelisted fields; if no document exists it instantiates a non-persisted `new Settings({})` so callers always get the schema defaults. Admin edits go through `/admin/settings` → `PATCH /api/admin/settings`. The order form consumes this through the `SettingsOverrides` type in `src/components/order/utils.ts`.

Because mixers, extras, and lease tiers are `Mixed`, Mongoose does not deep-validate or dirty-track them — reassign the whole object (or `markModified`) when updating.

### Analytics

`FingerprintTracker.tsx` uses ThumbmarkJS to generate a browser fingerprint and posts it to `/api/v1/analytics/fingerprint` (stored in `Thumbprint` model). `OrderFormTracker.tsx` does the same per order step — despite the name it touches neither `dataLayer` nor `gtag`, so the funnel is reconstructed from first-party fingerprint rows, not from GA4. `GET /api/admin/analytics` aggregates visitor and funnel data for `/admin/analytics` (Chart.js via `react-chartjs-2`).

GA4 itself receives only automatic pageviews and enhanced measurement. `GoogleAnalytics.tsx` loads gtag with `NEXT_PUBLIC_GA_MEASUREMENT_ID` and is the **only** path by which GA4 gets data: the GTM container in `NEXT_PUBLIC_GTM_ID` carries just the Google Ads conversion tags, no GA4 tag, so the two do not double-count. Both components render in production builds only. No custom GA4 events are emitted anywhere in the codebase.

### Reviews

`GET /api/v1/reviews` is a server-side proxy to `https://satxbounce.com/api/v1/reviews` with `next: { revalidate: 3600 }`. It exists so the browser never calls the external host directly (the CSP `connect-src` would block it) and so responses are cached for an hour.

### Security Headers & CSP

`next.config.ts` attaches HSTS, `X-Frame-Options`, `Permissions-Policy`, and a hand-written **Content-Security-Policy** to every route. The allowlists cover Google Analytics/GTM, `doubleclick.net`/`googleadservices.com` (Google Ads conversions and GA4 Google Signals) and `google.com` frames only — **adding any new third-party script, iframe, font, or fetch target requires editing that CSP string**, or it will silently fail in the browser.

Wildcard the host unless you are certain of the exact subdomain. `connect-src` once listed the bare host `www.google-analytics.com`, which does not match `region1.google-analytics.com` — the regional endpoint GA4 actually beacons to — so every hit was blocked and the property reported "data collection isn't active" with nothing failing server-side. `__tests__/security-headers.test.ts` now asserts the policy against the concrete third-party URLs to keep that class of regression loud. `script-src` still needs `'unsafe-inline'` for the GTM/GA bootstrap and JSON-LD blocks; moving those to a nonce is the outstanding hardening step. `compiler.removeConsole` strips `console.*` in production builds. Longer write-ups live in `docs/security.md` and `docs/auth-implementation.md`.

### Types

Global shared types live in `src/types/index.ts` (`MachineType`, `MixerType`, `PaymentStatus`, `RentalStatus`, `MargaritaRental`). Machine-specific types and runtime type guards (`isMachineType`, `isMixerType`) are in `src/types/machine.ts`. Admin-only types are in `src/types/admin.ts`.

### Key Library Exports

- `src/lib/rental-data.ts` — `machinePackages` and `mixerDetails` constants (source of base prices and machine metadata)
- `src/lib/pricing.ts` — `calculatePrice()` (core per-day price logic) and `formatPrice()` (currency display)
- `src/lib/inventory.ts` — `isMachineAvailable()`, `getMachineInventory()`, `releaseStaleHolds()` (all availability decisions)
- `src/lib/lease-data.ts` — `leaseTiers`, `mergeLeaseTiers()`, lease form enums
- `src/lib/extras-catalog.ts` — `buildExtrasCatalog()`, `resolveSelectedExtras()` (authoritative add-on pricing)
- `src/lib/validation.ts` — zod request schemas, `MACHINE_CAPACITY`, `escapeHtml()`
- `src/lib/api-guard.ts` / `src/lib/rate-limit.ts` — `guardPublicWrite()` for public write routes

## Date Handling

Date strings throughout the codebase are in `YYYY-MM-DD` format. Always parse them as **local midnight** by appending `T00:00:00` (e.g. `new Date(dateStr + "T00:00:00")`). Omitting the suffix causes the date to be parsed as UTC midnight, which shifts the date by the user's UTC offset.

## Environment Variables

```
MONGODB_URI, MONGODB_DB
ADMIN_USERNAME, ADMIN_PASSWORD_HASH   (legacy fallback: ADMIN_PASSWORD)
NEXTAUTH_SECRET, NEXTAUTH_URL
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, USER_PHONE_NUMBER
RESEND_API_KEY
NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_GA_MEASUREMENT_ID   (production only; unset means no GA4 data)
CRON_SECRET
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN   (optional; shared rate-limit store)
```

See `.env.sample` for the full list.

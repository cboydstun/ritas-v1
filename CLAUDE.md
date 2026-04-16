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

## Stack

Next.js 15 (App Router) · React 19 · TypeScript 5 · MongoDB/Mongoose · NextAuth.js v4 · PayPal · Tailwind CSS 3

## Architecture

### Routing & Pages

`src/app/` uses the Next.js App Router. Public pages live at the root (`/order`, `/pricing`, etc.). Admin pages are under `src/app/admin/` and are protected by middleware. API routes are split between `src/app/api/v1/` (public) and `src/app/api/admin/` (auth-required).

### Multi-Step Order Form

The order flow (`/order`) is a single client component `src/components/order/OrderForm.tsx` that manages a 5-step wizard: date → machine → details → extras → review. Each step is lazy-loaded via `next/dynamic`. Form state is persisted to `localStorage` under key `satx-ritas-order-draft` so drafts survive page reloads. On mount, the form fetches `/api/v1/settings` to get dynamic overrides (mixer options, delivery window hours, pricing). The `StepProps` interface in `src/components/order/types.ts` is the contract between the parent form and each step component.

### Pricing

The single source of truth for all order totals is `computeOrderTotal()` in `src/components/order/utils.ts`. It wraps `calculatePrice()` from `src/lib/pricing.ts` and adds multi-day, extras, and discount logic:

- `perDayRate = basePrice + mixerPrice`
- `subtotal = perDayRate × rentalDays + deliveryFee + extrasTotal` (extras and machine rate are per-day; delivery is flat)
- `serviceDiscountAmount = subtotal × discountRate` (default 10%, only if `isServiceDiscount` is set — military/service personnel perk)
- `discountedSubtotal = subtotal − serviceDiscountAmount`
- `processingFee = discountedSubtotal × processingFeeRate`
- `salesTax = discountedSubtotal × salesTaxRate`
- `finalTotal = discountedSubtotal + processingFee + salesTax`

Default constants: delivery $20, sales tax 8.25%, processing 3%, service discount 10%. Base machine prices come from `src/lib/rental-data.ts`. The `PricingOverrides` type in `src/lib/pricing.ts` and `SettingsOverrides` in `utils.ts` allow the admin `Settings` document to override any of these at runtime.

### Availability & Blackout Dates

The `useAvailabilityCheck` hook (`src/hooks/useAvailabilityCheck.ts`) calls `GET /api/v1/availability?machineType=&capacity=&date=`. That route checks blackout dates first (from the `BlackoutDate` model), then looks for conflicting confirmed/pending rentals. Admins manage blackout date ranges via `/admin/blackout-dates` → `GET/POST /api/admin/blackout-dates` and `DELETE /api/admin/blackout-dates/[id]`.

### Database

MongoDB via Mongoose. Connection is cached in `src/lib/mongodb.ts` using a global variable to avoid creating new connections on every serverless invocation. Models live in `src/models/`: `rental.ts`, `thumbprint.ts`, `contact.ts`, `blackout-date.ts`, `settings.ts`.

### Authentication (Admin)

NextAuth.js credentials provider. Config is in `src/lib/auth.ts`; admin credentials come from env vars `ADMIN_USERNAME`/`ADMIN_PASSWORD`. `src/middleware.ts` intercepts all `/admin/*` and `/api/admin/*` requests—unauthenticated page requests redirect to `/admin/login`, unauthenticated API requests return 401. Server components and API routes call `getServerSession(authOptions)` to verify access.

### PayPal Flow

1. Client submits the review step → calls `POST /api/create-paypal-order` (server-side SDK creates a PayPal order, returns `orderID`).
2. `PayPalCheckout.tsx` renders the PayPal button with that `orderID`.
3. On buyer approval, client calls `POST /api/capture-paypal-order` which captures payment and saves the `Rental` document to MongoDB. After capture, Twilio SMS and Nodemailer email notifications fire server-side.

There is also `POST /api/save-booking` used for admin-created manual bookings (no PayPal). It generates a `bookingId` via nanoid and sends confirmation via Resend email + Twilio SMS.

### Notifications

Triggered after successful payment capture or manual booking: SMS via Twilio (`TWILIO_*` env vars) and email via Nodemailer (Gmail SMTP) for PayPal orders, or Resend (`RESEND_API_KEY`) for manual bookings and contact form submissions.

### Admin Settings Override

The `Settings` Mongoose model stores a single document with runtime overrides for mixers, pricing rates, extras prices, and delivery window hours. The public `/api/v1/settings` endpoint exposes these to the order form. Admin can update them via `/admin/settings` → `PATCH /api/admin/settings`. The `SettingsOverrides` type in `src/components/order/utils.ts` is what the order form uses.

### Analytics

`FingerprintTracker.tsx` uses ThumbmarkJS to generate a browser fingerprint and posts it to `/api/v1/analytics/fingerprint` (stored in `Thumbprint` model). `OrderFormTracker.tsx` fires GA4/GTM events as users progress through order steps.

## Date Handling

Date strings throughout the codebase are in `YYYY-MM-DD` format. Always parse them as **local midnight** by appending `T00:00:00` (e.g. `new Date(dateStr + "T00:00:00")`). Omitting the suffix causes the date to be parsed as UTC midnight, which shifts the date by the user's UTC offset.

## Environment Variables

```
MONGODB_URI, MONGODB_DB
NEXT_PUBLIC_PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_LIVE_MODE
ADMIN_USERNAME, ADMIN_PASSWORD
NEXTAUTH_SECRET, NEXTAUTH_URL
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, USER_PHONE_NUMBER
NODEMAILER_USERNAME, NODEMAILER_PASSWORD
RESEND_API_KEY
NEXT_PUBLIC_GTM_ID
```

See `.env.sample` for the full list.

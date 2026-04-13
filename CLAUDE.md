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

All price math lives in `src/lib/pricing.ts`. Formula: `(basePrice + mixerPrice + deliveryFee) * (1 + taxRate + processingFeeRate)`. Default constants: delivery $20, sales tax 8.25%, processing 3%. The `PricingOverrides` type allows the admin `Settings` document to override any of these at runtime—fetch from `/api/v1/settings` and pass the overrides to `calculatePrice()`. Base machine prices come from `src/lib/rental-data.ts`.

### Database

MongoDB via Mongoose. Connection is cached in `src/lib/mongodb.ts` using a global variable to avoid creating new connections on every serverless invocation. Models live in `src/models/`: `rental.ts`, `thumbprint.ts`, `contact.ts`, `blackout-date.ts`, `settings.ts`.

### Authentication (Admin)

NextAuth.js credentials provider. Config is in `src/lib/auth.ts`; admin credentials come from env vars `ADMIN_USERNAME`/`ADMIN_PASSWORD`. `src/middleware.ts` intercepts all `/admin/*` and `/api/admin/*` requests—unauthenticated page requests redirect to `/admin/login`, unauthenticated API requests return 401. Server components and API routes call `getServerSession(authOptions)` to verify access.

### PayPal Flow

1. Client submits the review step → calls `POST /api/create-paypal-order` (server-side SDK creates a PayPal order, returns `orderID`).
2. `PayPalCheckout.tsx` renders the PayPal button with that `orderID`.
3. On buyer approval, client calls `POST /api/capture-paypal-order` which captures payment and saves the `Rental` document to MongoDB. After capture, Twilio SMS and Nodemailer/Resend email notifications fire server-side.

### Notifications

Triggered inside `/api/capture-paypal-order` after a successful payment capture: SMS via Twilio (`TWILIO_*` env vars) and email via both Nodemailer (Gmail SMTP) and Resend. Templates use `@react-email` components.

### Admin Settings Override

The `Settings` Mongoose model stores a single document with runtime overrides for mixers, pricing rates, and delivery window hours. The public `/api/v1/settings` endpoint exposes these to the order form. Admin can update them via `/admin/settings` → `PATCH /api/admin/settings`.

### Analytics

`FingerprintTracker.tsx` uses ThumbmarkJS to generate a browser fingerprint and posts it to `/api/v1/analytics/fingerprint` (stored in `Thumbprint` model). `OrderFormTracker.tsx` fires GA4/GTM events as users progress through order steps.

## Environment Variables

```
MONGODB_URI, MONGODB_DB
NEXT_PUBLIC_PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_LIVE_MODE
ADMIN_USERNAME, ADMIN_PASSWORD
NEXTAUTH_SECRET, NEXTAUTH_URL
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, USER_PHONE_NUMBER
NODEMAILER_USERNAME, NODEMAILER_PASSWORD
NEXT_PUBLIC_GTM_ID
```

See `.env.sample` for the full list.

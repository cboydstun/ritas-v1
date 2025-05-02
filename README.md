# SATX Ritas Rental Service

A modern web application built with Next.js and TypeScript for managing frozen drink machine rentals in San Antonio, TX. Features secure PayPal payment processing and a streamlined rental booking experience.

## Features

- 🎨 Modern, responsive design with dark/light theme support
- 💳 Secure PayPal payment integration
- 🗺️ Interactive map showing service area
- 📱 Multi-step rental booking process with Party Extras options
- 🔒 MongoDB database for order management
- 📄 Informative content pages (About, FAQ, Pricing, Contact)
- 🌙 Dark/light theme toggle
- 📝 Contact form for inquiries with email and SMS notifications
- 📊 Advanced analytics with browser fingerprinting and conversion tracking
- 📈 Order form funnel analysis to track user progression
- 📧 Email management system with customizable templates and tracking
- 🍹 Multiple machine options (15L, 30L, and 45L capacities)
- 📊 QuickBooks Online integration for automatic invoice generation

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework with App Router
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [MongoDB](https://www.mongodb.com/) - NoSQL database
- [PayPal API](https://developer.paypal.com/) - Secure payment processing
- [QuickBooks API](https://developer.intuit.com/) - Automated invoice generation
- [Twilio](https://www.twilio.com/) - SMS notifications
- [Resend](https://resend.com/) - Email delivery service with template management
- [Google Analytics](https://analytics.google.com/) - Website analytics
- [ThumbmarkJS](https://github.com/thumbmarkjs/thumbmarkjs) - Browser fingerprinting for enhanced analytics

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env.local` file with the following variables:

   ```
   # MongoDB Configuration
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DB=your_database_name

   # PayPal Configuration
   NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id    # Used by PayPal button component
   PAYPAL_CLIENT_SECRET=your_paypal_client_secret        # Server-side only
   PAYPAL_LIVE_MODE=false                               # Set to true in production

   # Node Environment
   NODE_ENV=development                                 # Use 'production' for live deployment

   # Twilio Configuration (for SMS notifications)
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   USER_PHONE_NUMBER=your_notification_phone_number

   # Resend Configuration (for email management)
   RESEND_API_KEY=your_resend_api_key
   DEFAULT_EMAIL_FROM=SATX Ritas <orders@satxritas.com>

   # Admin Panel Credentials
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password

   # QuickBooks Configuration
   QB_CLIENT_ID=your_quickbooks_client_id
   QB_CLIENT_SECRET=your_quickbooks_client_secret
   QB_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
   QB_ENVIRONMENT=sandbox                               # Use 'production' for live deployment
   QB_REALM_ID=your_quickbooks_company_id               # Obtained after first authentication

   # Analytics Configuration (optional)
   ANALYTICS_ENABLED=true
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API routes
│   │   ├── admin/        # Admin API endpoints
│   │   │   ├── orders/   # Order management endpoints
│   │   │   ├── analytics/ # Analytics data endpoints
│   │   │   ├── email-templates/ # Email template management endpoints
│   │   │   └── sent-emails/ # Sent email tracking endpoints
│   │   ├── v1/           # Version 1 API endpoints
│   │   │   └── analytics/ # Analytics data collection endpoints
│   │   ├── create-paypal-order/    # PayPal order creation
│   │   └── capture-paypal-order/   # PayPal payment capture
│   ├── about/             # About page
│   ├── admin/            # Admin dashboard
│   ├── contact/           # Contact page
│   ├── faq/               # FAQ page
│   ├── order/             # Rental order flow
│   ├── pricing/           # Pricing information
│   └── rentals/           # Rental management
├── components/            # React components
│   ├── admin/            # Admin dashboard components
│   ├── email-template.tsx # Email template component
│   ├── FingerprintTracker.tsx # Site-wide fingerprint tracking
│   ├── contact/           # Contact form components
│   ├── home/              # Homepage sections
│   │   ├── AboutSection   # Home page about section
│   │   ├── HeroSection   # Hero banner
│   │   ├── MapSection    # Service area map
│   │   └── SocialProof   # Customer testimonials
│   └── order/             # Order flow components
│       ├── steps/         # Multi-step form components including ExtrasStep
│       ├── OrderFormTracker.tsx # Form step tracking for analytics
│       └── types.ts       # Order type definitions and extras configuration
├── config/                # Configuration files
├── lib/                   # Utility functions
│   ├── mongodb.ts         # MongoDB connection
│   ├── paypal-server.ts   # PayPal integration
│   ├── email-service.ts   # Email service with Resend integration
│   └── rental-data.ts     # Rental data utilities
├── models/                # MongoDB models
│   ├── rental.ts         # Rental order model
│   ├── email-template.ts # Email template and sent email models
│   └── thumbprint.ts     # Analytics fingerprint model
└── types/                 # TypeScript type definitions
```

## API Routes

- `/api/create-paypal-order` - Initializes a new PayPal order with rental details and creates a pending rental in the database
- `/api/capture-paypal-order` - Captures and processes approved PayPal payments, updates rental status to confirmed, sends SMS notifications via Twilio, and sends confirmation emails via Resend
- `/api/admin/orders` - Admin endpoints for retrieving all orders and creating new orders
- `/api/admin/orders/[id]` - Admin endpoints for retrieving, updating, and deleting specific orders by ID
- `/api/admin/analytics` - Admin endpoint for retrieving analytics data including visitor stats and order form funnel metrics
- `/api/admin/email-templates` - Admin endpoints for creating and listing email templates
- `/api/admin/email-templates/[id]` - Admin endpoints for retrieving, updating, and deleting specific email templates
- `/api/admin/email-templates/preview` - Admin endpoint for previewing email templates with variables
- `/api/admin/email-templates/send-test` - Admin endpoint for sending test emails
- `/api/admin/sent-emails` - Admin endpoints for listing sent emails with pagination and filtering
- `/api/admin/sent-emails/[id]` - Admin endpoint for retrieving details of a specific sent email
- `/api/v1/analytics/fingerprint` - Endpoint for storing browser fingerprint data and tracking user journeys
- `/api/v1/contacts` - Endpoint for submitting contact form inquiries with email and SMS notifications
- `/api/admin/contacts` - Admin endpoints for managing contact form submissions
- `/api/admin/contacts/[id]` - Admin endpoints for retrieving, updating, and deleting specific contact submissions

## Key Components

- `OrderForm` - Multi-step rental booking process with validation and analytics tracking
- `ExtrasStep` - Party extras selection with quantity controls for table & chairs
- `ReviewStep` - Comprehensive order summary with detailed pricing breakdown
- `PaymentStep` - Secure payment processing with accurate pricing calculations
- `PayPalCheckout` - Secure PayPal payment integration
- `ThemeToggle` - Dark/light theme switcher with system preference detection
- `MapSection` - Interactive service area map with delivery zone highlighting
- `Navigation` - Responsive navigation bar with mobile menu
- `Footer` - Site-wide footer with social links and contact information
- `ContactForm` - Validated contact form with email and SMS notifications
- `ThemeWrapper` - Theme context provider for consistent styling
- `OrdersTable` - Admin dashboard for managing rental orders
- `EditOrderModal` - Modal for editing order details in admin panel
- `EmailTemplateForm` - Form for creating and editing email templates with variables
- `EmailPreview` - Component for previewing email templates with variable substitution
- `EmailTemplateList` - List of email templates with actions for edit, preview, and delete
- `SentEmailList` - List of sent emails with filtering, pagination, and detailed view
- `GoogleAnalytics` - Component for integrating Google Analytics tracking
- `FingerprintTracker` - Site-wide browser fingerprinting for enhanced analytics
- `OrderFormTracker` - Step-by-step tracking of user progression through the order form

## Deployment

The application is optimized for deployment on [Vercel](https://vercel.com). To deploy:

1. Push your code to a Git repository
2. Import the project to Vercel
3. Configure environment variables in the Vercel dashboard
4. Deploy!

For other deployment options, refer to the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

## Images and Assets

The `/public` directory contains optimized images for:

- Frozen drink machines (VEVOR 15L and 30L models)
- Popular drink varieties (Margaritas, Piña Coladas, etc.)
- Favicons and OG images for social sharing

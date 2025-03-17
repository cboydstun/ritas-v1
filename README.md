# SATX Ritas Rental Service

A modern web application built with Next.js and TypeScript for managing frozen drink machine rentals in San Antonio, TX. Features secure PayPal payment processing and a streamlined rental booking experience.

## Features

- 🎨 Modern, responsive design with dark/light theme support
- 💳 Secure PayPal payment integration
- 🗺️ Interactive map showing service area
- 📱 Multi-step rental booking process
- 🔒 MongoDB database for order management
- 📄 Informative content pages (About, FAQ, Pricing, Contact)
- 🌙 Dark/light theme toggle
- 📝 Contact form for inquiries
- 📊 Google Analytics integration
- 📧 Email notifications for order confirmations
- 🍹 Multiple machine options (15L, 30L, and 45L capacities)

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework with App Router
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [MongoDB](https://www.mongodb.com/) - NoSQL database
- [PayPal API](https://developer.paypal.com/) - Secure payment processing
- [Twilio](https://www.twilio.com/) - SMS notifications
- [Nodemailer](https://nodemailer.com/) - Email notifications
- [Google Analytics](https://analytics.google.com/) - Website analytics

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

   # Nodemailer Configuration (for email notifications)
   NODEMAILER_USERNAME=your_gmail_address
   NODEMAILER_PASSWORD=your_gmail_app_password

   # Admin Panel Credentials
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password
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
│   ├── contact/           # Contact form components
│   ├── home/              # Homepage sections
│   │   ├── AboutSection   # Home page about section
│   │   ├── HeroSection   # Hero banner
│   │   ├── MapSection    # Service area map
│   │   └── SocialProof   # Customer testimonials
│   └── order/             # Order flow components
│       ├── steps/         # Multi-step form components
│       └── types.ts       # Order type definitions
├── config/                # Configuration files
├── lib/                   # Utility functions
│   ├── mongodb.ts         # MongoDB connection
│   ├── paypal-server.ts   # PayPal integration
│   └── rental-data.ts     # Rental data utilities
├── models/                # MongoDB models
└── types/                 # TypeScript type definitions
```

## API Routes

- `/api/create-paypal-order` - Initializes a new PayPal order with rental details and creates a pending rental in the database
- `/api/capture-paypal-order` - Captures and processes approved PayPal payments, updates rental status to confirmed, sends SMS notifications via Twilio, and sends confirmation emails via Nodemailer
- `/api/admin/orders` - Admin endpoints for retrieving all orders and creating new orders
- `/api/admin/orders/[id]` - Admin endpoints for retrieving, updating, and deleting specific orders by ID

## Key Components

- `OrderForm` - Multi-step rental booking process with validation
- `PayPalCheckout` - Secure PayPal payment integration
- `ThemeToggle` - Dark/light theme switcher with system preference detection
- `MapSection` - Interactive service area map with delivery zone highlighting
- `Navigation` - Responsive navigation bar with mobile menu
- `Footer` - Site-wide footer with social links and contact information
- `ContactForm` - Validated contact form with email integration
- `ThemeWrapper` - Theme context provider for consistent styling
- `OrdersTable` - Admin dashboard for managing rental orders
- `EditOrderModal` - Modal for editing order details in admin panel
- `GoogleAnalytics` - Component for integrating Google Analytics tracking

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

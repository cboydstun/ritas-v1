# SATX Ritas Rental Service

A modern web application built with Next.js 14 and TypeScript for managing frozen drink machine rentals in San Antonio, TX. Features secure PayPal payment processing and a streamlined rental booking experience.

## Features

- 🎨 Modern, responsive design with dark/light theme support
- 💳 Secure PayPal payment integration
- 🗺️ Interactive map showing service area
- 📱 Multi-step rental booking process
- 🔒 MongoDB database for order management
- 📄 Informative content pages (About, FAQ, Pricing, Contact)
- 🌙 Dark/light theme toggle
- 📝 Contact form for inquiries

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework with App Router
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [MongoDB](https://www.mongodb.com/) - NoSQL database
- [PayPal API](https://developer.paypal.com/) - Secure payment processing

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env.local` file with the following variables:

   ```
   MONGODB_URI=your_mongodb_connection_string
   PAYPAL_CLIENT_ID=your_paypal_client_id
   PAYPAL_CLIENT_SECRET=your_paypal_client_secret
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

```
src/
├── app/                    # Next.js 14 App Router pages
│   ├── api/               # API routes
│   ├── about/             # About page
│   ├── contact/           # Contact page
│   ├── faq/              # FAQ page
│   ├── order/            # Rental order flow
│   ├── pricing/          # Pricing information
│   └── rentals/          # Rental management
├── components/            # React components
│   ├── contact/          # Contact form components
│   ├── home/             # Homepage sections
│   └── order/            # Order flow components
├── config/               # Configuration files
├── lib/                  # Utility functions
│   ├── mongodb.ts        # MongoDB connection
│   ├── paypal-server.ts  # PayPal integration
│   └── rental-data.ts    # Rental data utilities
└── types/                # TypeScript type definitions
```

## API Routes

- `/api/create-paypal-order` - Initializes a new PayPal order
- `/api/capture-paypal-order` - Captures payment after approval
- `/api/save-rental` - Persists rental information to MongoDB

## Key Components

- `OrderForm` - Multi-step rental booking process
- `PayPalCheckout` - PayPal payment integration
- `ThemeToggle` - Dark/light theme switcher
- `MapSection` - Interactive service area map
- `Navigation` - Responsive navigation bar
- `Footer` - Site-wide footer

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

# SATX Ritas Rental Service

A modern web application built with Next.js for managing and processing rental orders with integrated PayPal payments.

## Features

- 📱 Responsive design with dark/light theme support
- 💳 Secure PayPal payment integration
- 🗺️ Interactive map section
- 📝 Order management system
- 🔒 MongoDB database integration
- 📄 Dynamic content pages (About, FAQ, Pricing, Contact)

## Tech Stack

- [Next.js 14](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [MongoDB](https://www.mongodb.com/) - Database
- [PayPal API](https://developer.paypal.com/) - Payment processing

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

- `/src/app/*` - Application pages and API routes
- `/src/components/*` - Reusable React components
- `/src/lib/*` - Utility functions and service integrations
- `/src/types/*` - TypeScript type definitions
- `/public/*` - Static assets

## API Routes

- `/api/create-paypal-order` - Creates a new PayPal order
- `/api/capture-paypal-order` - Captures payment for a PayPal order
- `/api/save-rental` - Saves rental information to MongoDB

## Deployment

The application is optimized for deployment on [Vercel](https://vercel.com). To deploy:

1. Push your code to a Git repository
2. Import the project to Vercel
3. Configure environment variables in the Vercel dashboard
4. Deploy!

For other deployment options, refer to the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

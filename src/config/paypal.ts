import { ReactPayPalScriptOptions } from '@paypal/react-paypal-js';

// Client-side PayPal configuration
export const paypalConfig: ReactPayPalScriptOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
    currency: "USD",
    intent: "capture",
};

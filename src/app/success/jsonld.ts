import { OrderFormData } from "@/components/order/types";

export function generateOrderJsonLd(orderId: string, machineType: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Order",
    "orderNumber": orderId,
    "orderStatus": "https://schema.org/OrderDelivered",
    "merchant": {
      "@type": "Organization",
      "name": "SATX Ritas Rentals",
      "logo": "https://satxritas.com/og-image.jpg",
    },
    "acceptedOffer": {
      "@type": "Offer",
      "itemOffered": {
        "@type": "Product",
        "name": `${machineType.charAt(0).toUpperCase() + machineType.slice(1)} Tank Frozen Drink Machine`,
        "description": "Professional frozen drink machine rental service including delivery, setup, and pickup.",
      }
    },
    "potentialAction": {
      "@type": "ViewAction",
      "target": "https://satxritas.com/contact"
    }
  };
}

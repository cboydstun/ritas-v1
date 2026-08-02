import { SITE_URL } from "@/lib/site";

export function generateOrderJsonLd(orderId: string, machineType: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Order",
    orderNumber: orderId,
    orderStatus: "https://schema.org/OrderDelivered",
    merchant: {
      "@type": "Organization",
      name: "SATX Ritas Rentals",
      logo: `${SITE_URL}/og-image.jpg`,
    },
    acceptedOffer: {
      "@type": "Offer",
      itemOffered: {
        "@type": "Product",
        name: `${machineType.charAt(0).toUpperCase() + machineType.slice(1)} Tank Frozen Drink Machine`,
        description:
          "Professional frozen drink machine rental service including delivery, setup, and pickup.",
      },
    },
    potentialAction: {
      "@type": "ViewAction",
      target: `${SITE_URL}/contact`,
    },
  };
}

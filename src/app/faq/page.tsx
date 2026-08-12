import { Metadata } from "next";
import { mixerDetails } from "@/lib/rental-data";
import Link from "next/link";
import BookingCTA from "@/components/BookingCTA";
import { SITE_URL } from "@/lib/site";

// Get all mixer names except "non-alcoholic" for the mixer options text
const alcoholicMixers = Object.entries(mixerDetails)
  .filter(([key]) => key !== "non-alcoholic")
  .map(([, details]) => details.label)
  .join(", ");

export const metadata: Metadata = {
  alternates: { canonical: "/faq" },
  title: "Frequently Asked Questions | Ritas Frozen Drink Machine Rentals",
  description:
    "Find answers to common questions about our frozen drink machine rentals, including delivery, setup, mixers, payment options, and policies in San Antonio.",
  openGraph: {
    title: "FAQ - Ritas Frozen Drink Machine Rentals",
    description:
      "Everything you need to know about renting frozen drink machines in San Antonio, from setup to mixers and policies.",
    type: "website",
  },
};

/**
 * The single source for both the rendered Q&A and the FAQPage JSON-LD.
 *
 * Answers are plain strings so the structured data matches the visible text
 * exactly — Google discards FAQ markup whose answer is not on the page.
 */
const faqSections: Array<{
  id: string;
  heading: string;
  cta: { href: string; label: string };
  items: Array<{ question: string; answer: string }>;
}> = [
  {
    id: "rental-basics",
    heading: "Rental Basics",
    cta: { href: "/pricing", label: "Pricing" },
    items: [
      {
        question: "What is included with my rental?",
        answer:
          "Each rental includes the machine of your choice, any selected mixers, a salt rimmer for your glasses, and a table for setup. We handle all delivery, setup, and pickup for you.",
      },
      {
        question: "How long is the rental period?",
        answer:
          "Each rental includes free overnight use by default. We will deliver and set up your machine on the day of your event, and return the next day to pick everything up. Extended rental periods are available upon request.",
      },
      {
        question: "What if something goes wrong during my event?",
        answer:
          "We provide 24/7 support during your rental period. If any issues arise, we will quickly respond to ensure your event continues smoothly.",
      },
    ],
  },
  {
    id: "drinks-mixers",
    heading: "Drinks & Mixers",
    cta: { href: "/order", label: "Start Your Order" },
    items: [
      {
        question: "What about the alcohol?",
        answer:
          "You will provide your own alcohol. During setup, we will guide you on the right amount needed for your chosen mixer and provide mixing instructions for the perfect drink consistency.",
      },
      {
        question: "What mixer options are available?",
        answer: `We offer premium mixers including ${alcoholicMixers}. For family-friendly events, we also provide ${mixerDetails["non-alcoholic"].label}. You can also choose to use your own mixers for complete control over your drinks.`,
      },
      {
        question: "How many drinks can each machine make?",
        answer:
          "Our 15L single tank machine (nearly 4 gallons) provides 50-60 8oz servings. The 30L double tank machine doubles this capacity to 100-120 servings, with the added benefit of offering two different flavors.",
      },
    ],
  },
  {
    id: "delivery-setup",
    heading: "Delivery & Setup",
    cta: { href: "/about", label: "About Us" },
    items: [
      {
        question: "Do you provide delivery?",
        answer:
          "Yes! We handle everything for you - delivery, professional setup, and next-day pickup throughout the San Antonio metropolitan area. Our team will handle all the heavy lifting and ensure everything is working perfectly.",
      },
      {
        question: "What space requirements are needed?",
        answer:
          "You will need a flat, stable surface near a power outlet. Single machines require about 2x2 feet of space, while double machines need 3x2 feet. We provide a table with your rental and will help determine the best location during delivery.",
      },
      {
        question: "Can the machines be used outdoors?",
        answer:
          "Yes, but they must be protected from direct sunlight and rain. We recommend placing them under a tent or covered area. They should also be on a stable, level surface.",
      },
    ],
  },
  {
    id: "payment-policies",
    heading: "Payment & Policies",
    cta: { href: "/order", label: "Start Your Order" },
    items: [
      {
        question: "What payment methods do you accept?",
        answer:
          "We accept all major credit cards, cash, and digital payments through services like Venmo and Cash App. A deposit is required to secure your reservation.",
      },
      {
        question: "What is your cancellation policy?",
        answer:
          "We understand plans can change. For that reason, we wait until the day before the event to send the invoice. We do not expect any payment until delivery. For those reasons, we do not offer any refunds. If you paid for a machine rental, then you will get your machine rental but there will be no refunds.",
      },
      {
        question: "Do you offer insurance?",
        answer:
          "Our machines are fully insured, and we handle all maintenance and repairs. You are only responsible for preventing intentional damage or misuse during your rental period.",
      },
    ],
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/faq#faq`,
  mainEntity: faqSections.flatMap((section) =>
    section.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  ),
};

function FAQSection({ section }: { section: (typeof faqSections)[number] }) {
  return (
    <section
      aria-labelledby={section.id}
      className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-8"
    >
      <h2
        id={section.id}
        className="text-2xl font-bold text-charcoal dark:text-white mb-6"
      >
        {section.heading}
      </h2>
      <div className="space-y-6">
        {section.items.map((item) => (
          <div key={item.question}>
            <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-2">
              {item.question}
            </h3>
            <p className="text-charcoal/80 dark:text-white/80">{item.answer}</p>
          </div>
        ))}

        <div className="text-center mt-8">
          <Link
            href={section.cta.href}
            className="inline-block px-8 py-4 bg-margarita hover:bg-margarita/90 text-white font-semibold rounded-lg transition-colors text-lg"
          >
            {section.cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function FAQ() {
  return (
    <div className="relative isolate px-6 pt-14 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Decorative blurs */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-margarita to-teal opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl">
        {/* Hero section */}
        <div className="text-center mb-16">
          <div className="mb-8 inline-block">
            <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 dark:bg-margarita/10 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce">
              ❓ Got questions?
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-charcoal dark:text-white sm:text-6xl mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-charcoal/80 dark:text-white/80 max-w-2xl mx-auto">
            Everything you need to know about our frozen drink machine rentals
          </p>
        </div>

        {/* FAQ sections */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          {faqSections.slice(0, 3).map((section) => (
            <FAQSection key={section.id} section={section} />
          ))}

          {/* Booking CTA */}
          <BookingCTA
            headline="Still have questions?"
            subtext="Reach out anytime or jump straight to booking — we're here to make your event perfect."
            className="mb-8"
          />

          <FAQSection section={faqSections[3]} />
        </div>
      </div>
    </div>
  );
}

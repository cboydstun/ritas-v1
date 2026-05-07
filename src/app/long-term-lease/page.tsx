import { Metadata } from "next";
import Script from "next/script";
import BookingCTA from "@/components/BookingCTA";
import LeaseTierCard from "@/components/lease/LeaseTierCard";
import LeaseInquiryForm from "@/components/lease/LeaseInquiryForm";
import { mergeLeaseTiers } from "@/lib/lease-data";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Long-Term Frozen Drink Machine Lease",
  serviceType: "Long-Term Frozen Drink Machine Lease",
  description:
    "Long-term margarita machine and frozen drink machine leasing for restaurants, golf courses, hotel resorts, sports bars, and drive-thru daiquiri shops in the San Antonio area.",
  areaServed: {
    "@type": "City",
    name: "San Antonio",
  },
  provider: {
    "@type": "Organization",
    name: "SATX Ritas Rentals",
    url: "https://satxritas.com",
    telephone: "+1-512-210-0194",
    email: "satxbounce@gmail.com",
  },
};

export const metadata: Metadata = {
  title: "Long-Term Frozen Drink Machine Leases | SATX Ritas",
  description:
    "Long-term margarita and frozen drink machine leases for restaurants, golf courses, hotels, and bars in San Antonio. Placement, install, and maintenance included.",
};

const includedItems = [
  {
    icon: "🚚",
    title: "Delivery & Placement",
    body: "We handle scheduling, delivery, and on-site installation at your venue.",
  },
  {
    icon: "🛠️",
    title: "Install & Training",
    body: "Your staff is trained on operation, sanitation, and daily cleaning.",
  },
  {
    icon: "🧰",
    title: "Preventive Maintenance",
    body: "Quarterly service visits keep your machine running at peak efficiency.",
  },
  {
    icon: "🍹",
    title: "Mixer Supply Program",
    body: "Optional flavor supply program with margarita, piña colada, and daiquiri mixes.",
  },
  {
    icon: "🔁",
    title: "Swap-Out Coverage",
    body: "If a machine ever needs major service, we deliver a replacement so you keep selling.",
  },
  {
    icon: "🎨",
    title: "Custom Branding",
    body: "Add your logo to your machine for an in-house custom look.",
  },
];

const whyLease = [
  {
    icon: "💰",
    title: "Predictable Revenue Stream",
    body: "Frozen drinks carry strong margins and pour fast. A leased machine pays for itself with steady weekly volume.",
  },
  {
    icon: "🛡️",
    title: "Guaranteed Availability",
    body: "Your machine stays running. We cover preventive maintenance and ship a swap-out unit if anything goes wrong.",
  },
  {
    icon: "🤝",
    title: "Local, Hands-On Support",
    body: "San Antonio-based service team — when you call, you reach someone who can be on site fast.",
  },
];

async function fetchSettings() {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    const response = await fetch(`${baseUrl}/api/v1/settings`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default async function LongTermLeasePage() {
  const settings = await fetchSettings();
  const tiers = mergeLeaseTiers(settings?.leaseTiers);
  const docPdf =
    settings?.documentation?.pdfUrl &&
    typeof settings.documentation.pdfUrl === "string"
      ? {
          url: settings.documentation.pdfUrl as string,
          label:
            (settings.documentation.pdfLabel as string) ||
            "Download Lease Documentation (PDF)",
        }
      : null;

  return (
    <>
      <Script
        id="long-term-lease-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-gradient-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 dark:bg-pink/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-xl animate-pulse" />
        </div>

        <div className="relative pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Hero */}
            <div className="text-center mb-12">
              <div className="mb-8 inline-block">
                <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 dark:bg-margarita/10 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce">
                  🏢 B2B Leasing
                </span>
              </div>
              <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight">
                Long-Term
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2">
                  Machine Leases
                </span>
              </h1>
              <div className="max-w-3xl mx-auto">
                <p className="text-xl text-charcoal/80 dark:text-white/80 mb-4">
                  Premium frozen drink machines for restaurants, golf courses,
                  hotels, sports bars, and drive-thru daiquiri shops across the
                  San Antonio area.
                </p>
                <p className="text-lg text-charcoal/70 dark:text-white/70">
                  Flexible terms, professional placement, ongoing maintenance —
                  with month-to-month options available.
                </p>
              </div>
            </div>

            {/* Phone CTA strip */}
            <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl mb-12 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
              <p className="text-charcoal dark:text-white text-lg font-semibold">
                Ready to lease? Talk to our team.
              </p>
              <a
                href="tel:+15122100194"
                className="inline-block px-8 py-3 bg-gradient-to-r from-margarita to-teal text-white rounded-lg hover:shadow-lg hover:shadow-margarita/30 transform hover:-translate-y-1 transition-all duration-300 font-semibold"
              >
                📞 Call (512) 210-0194
              </a>
              {docPdf && (
                <a
                  href={docPdf.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-8 py-3 bg-gradient-to-r from-orange to-pink text-white rounded-lg hover:shadow-lg hover:shadow-orange/30 transform hover:-translate-y-1 transition-all duration-300 font-semibold"
                >
                  📄 {docPdf.label}
                </a>
              )}
            </div>

            {/* Tier cards */}
            <div className="mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal dark:text-white mb-2 text-center">
                Lease Options
              </h2>
              <p className="text-center text-charcoal/70 dark:text-white/70 mb-8">
                Pick the machine that fits your venue. All leases include
                placement, training, and maintenance.
              </p>
              <div className="grid md:grid-cols-3 gap-8">
                {tiers.map((tier) => (
                  <LeaseTierCard key={tier.id} tier={tier} />
                ))}
              </div>
            </div>

            {/* Why lease */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              {whyLease.map((item) => (
                <div
                  key={item.title}
                  className="bg-white/80 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl"
                >
                  <div className="text-4xl mb-4">{item.icon}</div>
                  <h3 className="text-xl font-bold text-charcoal dark:text-white mb-3">
                    {item.title}
                  </h3>
                  <p className="text-charcoal/70 dark:text-white/70">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>

            {/* What's included */}
            <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-16">
              <h2 className="text-3xl font-bold text-charcoal dark:text-white mb-6 text-center">
                What&apos;s Included With Every Lease
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {includedItems.map((item) => (
                  <div
                    key={item.title}
                    className="bg-margarita/5 dark:bg-margarita/10 rounded-xl p-5"
                  >
                    <div className="text-3xl mb-2">{item.icon}</div>
                    <h3 className="font-bold text-charcoal dark:text-white mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-charcoal/70 dark:text-white/70">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Inquiry form */}
            <div
              id="inquiry-form"
              className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl mb-16 scroll-mt-24"
            >
              <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-bold text-charcoal dark:text-white mb-2 text-center">
                  Request a Lease Quote
                </h2>
                <p className="text-center text-charcoal/70 dark:text-white/70 mb-8">
                  Tell us about your venue and we&apos;ll get back to you with
                  pricing, term options, and a placement timeline.
                </p>
                <LeaseInquiryForm tiers={tiers} />
              </div>
            </div>

            <BookingCTA
              headline="Need a machine for a one-time event instead?"
              subtext="If you're hosting a private party or special event, our day rentals come with delivery, setup, and pickup included. Book online in minutes."
            />
          </div>
        </div>
      </div>
    </>
  );
}

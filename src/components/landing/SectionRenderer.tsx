import Link from "next/link";
import BookingCTA from "@/components/BookingCTA";
import { machinePackages } from "@/lib/rental-data";
import { formatPrice, type PublicPriceTable } from "@/lib/pricing";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_HREF } from "@/lib/site";
import { nearbyServiceAreas } from "@/lib/service-areas";
import type { ContentSection, CtaLink } from "@/lib/landing";

/**
 * Renders one resolved content section.
 *
 * Server components throughout — nothing here is interactive, and keeping it
 * server-side is what puts the copy into the HTML Google indexes.
 *
 * `table` is null when the page carries no pricing section; that makes it a
 * type error to render a price without having read Settings first.
 */
interface SectionRendererProps {
  section: ContentSection;
  table: PublicPriceTable | null;
}

const H2 = "text-2xl font-bold text-charcoal dark:text-white mb-4";
const BODY = "text-charcoal/80 dark:text-white/80";

function PrimaryButton({ link }: { link: CtaLink }) {
  return (
    <Link
      href={link.href}
      className="px-6 py-3 rounded-xl font-bold text-center text-white bg-margarita hover:bg-teal transition-colors"
    >
      {link.label}
    </Link>
  );
}

function SecondaryButton({ link }: { link: CtaLink }) {
  return (
    <Link
      href={link.href}
      className="px-6 py-3 rounded-xl font-bold text-center text-margarita border-2 border-margarita hover:bg-margarita hover:text-white transition-colors"
    >
      {link.label}
    </Link>
  );
}

export default function SectionRenderer({
  section,
  table,
}: SectionRendererProps) {
  switch (section.kind) {
    case "hero":
      return (
        <header className="mb-12">
          {section.eyebrow && (
            <p className="text-sm font-semibold uppercase tracking-wide text-teal mb-3">
              {section.eyebrow}
            </p>
          )}
          <h1 className="text-4xl sm:text-5xl font-bold text-charcoal dark:text-white mb-4">
            {section.heading}
          </h1>
          {section.body && (
            <p className={`text-lg ${BODY} mb-8 max-w-3xl`}>{section.body}</p>
          )}
          {(section.primaryCta || section.secondaryCta || section.phoneCta) && (
            <div className="flex flex-col sm:flex-row gap-3">
              {section.primaryCta && (
                <PrimaryButton link={section.primaryCta} />
              )}
              {section.secondaryCta && (
                <SecondaryButton link={section.secondaryCta} />
              )}
              {/* The number comes from site.ts, never from the document, so
                  it changes in one place across every page. */}
              {section.phoneCta && (
                <a
                  href={BUSINESS_PHONE_HREF}
                  className="px-6 py-3 rounded-xl font-bold text-center text-margarita border-2 border-margarita hover:bg-margarita hover:text-white transition-colors"
                >
                  Call {BUSINESS_PHONE_DISPLAY}
                </a>
              )}
            </div>
          )}
        </header>
      );

    case "richText":
      return (
        <section className="mb-12">
          {section.heading && <h2 className={H2}>{section.heading}</h2>}
          {/* Authored HTML. `hasDangerousHtml` on the write path is
              defense-in-depth, not sanitisation — the control that matters is
              that only an authenticated admin can write here. */}
          <div
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: section.html }}
          />
        </section>
      );

    case "features":
      return (
        <section className="mb-12">
          {section.heading && <h2 className={H2}>{section.heading}</h2>}
          {section.intro && <p className={`${BODY} mb-4`}>{section.intro}</p>}
          <ul className={`space-y-2 ${BODY}`}>
            {section.items.map((item, index) => (
              <li key={index}>
                {item.icon && <span aria-hidden="true">{item.icon} </span>}
                {item.title && <strong>{item.title} — </strong>}
                {item.body}
              </li>
            ))}
          </ul>
        </section>
      );

    case "faq":
      // Also emitted as a FAQPage node by `buildFaqJsonLd`, derived from these
      // same items so the two cannot drift.
      return (
        <section className="mb-12">
          {section.heading && <h2 className={H2}>{section.heading}</h2>}
          <dl className="space-y-4">
            {section.items.map((item, index) => (
              <div key={index}>
                <dt className="font-semibold text-charcoal dark:text-white">
                  {item.question}
                </dt>
                <dd className={BODY}>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      );

    case "cta":
      return (
        <BookingCTA headline={section.headline} subtext={section.subtext} />
      );

    case "linkList":
      return (
        <section className="mb-12">
          {section.heading && <h2 className={H2}>{section.heading}</h2>}
          <ul className="flex flex-wrap gap-3">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block px-4 py-2 rounded-lg bg-light dark:bg-charcoal/50 text-charcoal dark:text-white hover:text-margarita transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {section.footerLink && (
            <p className="mt-4 text-sm">
              <Link
                href={section.footerLink.href}
                className="text-margarita underline hover:no-underline"
              >
                {section.footerLink.label}
              </Link>
            </p>
          )}
        </section>
      );

    case "pricingCards": {
      // Prices resolve from Settings at request time, never from the stored
      // document — that is what keeps an admin price change flowing into every
      // page carrying this section.
      if (!table) return null;
      return (
        <section className="mb-12">
          {section.heading && <h2 className={H2}>{section.heading}</h2>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {machinePackages.map((pkg) => (
              <div
                key={pkg.type}
                className="bg-light dark:bg-charcoal/50 rounded-xl p-6"
              >
                <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-1">
                  {pkg.name}
                </h3>
                <p className="text-2xl font-bold text-margarita mb-3">
                  ${formatPrice(table.machineBasePrice(pkg.type))}
                  <span className="text-sm font-normal text-charcoal/70 dark:text-white/70">
                    {" "}
                    / day
                  </span>
                </p>
                <p className={`text-sm ${BODY}`}>{pkg.description}</p>
              </div>
            ))}
          </div>
        </section>
      );
    }

    case "nearbyAreas": {
      // Computed from the service-area list, so adding a new area updates the
      // mesh on every existing page without touching a document.
      const nearby = nearbyServiceAreas(section.forSlug);
      if (nearby.length === 0) return null;
      return (
        <section className="mb-12">
          <h2 className={H2}>{section.heading ?? "We also deliver nearby"}</h2>
          <ul className="flex flex-wrap gap-3">
            {nearby.map((area) => (
              <li key={area.slug}>
                <Link
                  href={`/service-area/${area.slug}`}
                  className="inline-block px-4 py-2 rounded-lg bg-light dark:bg-charcoal/50 text-charcoal dark:text-white hover:text-margarita transition-colors"
                >
                  {area.name}
                </Link>
              </li>
            ))}
          </ul>
          {section.footerLink && (
            <p className="mt-4 text-sm">
              <Link
                href={section.footerLink.href}
                className="text-margarita underline hover:no-underline"
              >
                {section.footerLink.label}
              </Link>
            </p>
          )}
        </section>
      );
    }

    default:
      // A document written by a newer deploy must not take the page into the
      // error boundary. An unknown kind renders nothing.
      return null;
  }
}

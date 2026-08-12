import Link from "next/link";
import {
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_PHONE_HREF,
  GOOGLE_REVIEW_URL,
  SITE_URL,
} from "@/lib/site";

/**
 * What to do with the highest-intent page on the site.
 *
 * `/success` is the only page every booking customer reaches, and it ended at
 * a "Return Home" button — no review ask, no referral, no route back into the
 * content that answers day-of questions.
 *
 * The review link renders only when NEXT_PUBLIC_GOOGLE_REVIEW_URL is set:
 * there is no derivable URL for a Google Business profile, and a broken review
 * link is worse than none.
 */
export default function SuccessNextActions({
  bookingId,
}: {
  bookingId: string;
}) {
  const shareText = `We just booked a frozen drink machine from SATX Ritas for our party — ${SITE_URL}`;

  return (
    <div className="space-y-4 mb-8">
      <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
        <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
          Before your event
        </h3>
        <ul className="space-y-3 text-charcoal/70 dark:text-white/70">
          <li>
            📋 Read the{" "}
            <Link href="/faq" className="text-margarita underline">
              day-of FAQ
            </Link>{" "}
            — power, space, ice and how early to start freezing.
          </li>
          <li>
            📞 Anything to change? Call{" "}
            <a href={BUSINESS_PHONE_HREF} className="text-margarita underline">
              {BUSINESS_PHONE_DISPLAY}
            </a>{" "}
            and quote booking <strong>{bookingId}</strong>.
          </li>
          <li>
            🏢 Running a bar, restaurant or venue?{" "}
            <Link href="/long-term-lease" className="text-margarita underline">
              Long-term leases
            </Link>{" "}
            start at a fraction of the event rate.
          </li>
        </ul>
      </div>

      <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
        <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
          Spread the word
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {GOOGLE_REVIEW_URL && (
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center px-4 py-3 rounded-xl font-medium text-white bg-margarita hover:bg-margarita/90 transition-colors"
            >
              ⭐ Leave us a review
            </a>
          )}
          <a
            href={`sms:?&body=${encodeURIComponent(shareText)}`}
            className="flex-1 text-center px-4 py-3 rounded-xl font-medium text-charcoal dark:text-white bg-light dark:bg-charcoal/50 hover:bg-light/80 dark:hover:bg-charcoal/40 transition-colors"
          >
            💬 Text a friend
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(
              "Frozen drink machine rental in San Antonio",
            )}&body=${encodeURIComponent(shareText)}`}
            className="flex-1 text-center px-4 py-3 rounded-xl font-medium text-charcoal dark:text-white bg-light dark:bg-charcoal/50 hover:bg-light/80 dark:hover:bg-charcoal/40 transition-colors"
          >
            ✉️ Email a friend
          </a>
        </div>
      </div>
    </div>
  );
}

import Image from "next/image";
import { type LeaseTier } from "@/lib/lease-data";
import { formatPrice } from "@/lib/pricing";

interface LeaseTierCardProps {
  tier: LeaseTier;
}

export default function LeaseTierCard({ tier }: LeaseTierCardProps) {
  const termLabel =
    tier.minimumTermMonths === 1
      ? "Month-to-month"
      : `${tier.minimumTermMonths}-month minimum`;

  return (
    <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-sm rounded-2xl shadow-xl flex flex-col overflow-hidden">
      <div className="relative w-full aspect-[4/3] bg-light dark:bg-charcoal/40">
        <Image
          src={tier.image}
          alt={tier.name}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-charcoal dark:text-white mb-2">
          {tier.name}
        </h3>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-margarita to-teal">
            ${formatPrice(tier.monthlyRate)}
          </span>
          <span className="text-charcoal/70 dark:text-white/70 text-sm font-medium">
            / month
          </span>
        </div>
        <p className="text-xs text-charcoal/60 dark:text-white/60 mb-4">
          ${formatPrice(tier.placementFee)} one-time placement fee · {termLabel}
        </p>

        <div className="bg-margarita/5 dark:bg-margarita/10 rounded-lg px-3 py-2 mb-4">
          <p className="text-sm text-charcoal/80 dark:text-white/80">
            <span className="font-semibold">Best for: </span>
            {tier.bestFor}
          </p>
        </div>

        <ul className="space-y-2 mb-5 flex-grow">
          {tier.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-sm text-charcoal/80 dark:text-white/80"
            >
              <span aria-hidden="true">✅</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-5 space-y-1 text-xs text-charcoal/60 dark:text-white/60">
          <p>
            <span className="font-semibold">Electrical:</span> {tier.electrical}
          </p>
          <p>
            <span className="font-semibold">Space:</span>{" "}
            {tier.spaceRequirements}
          </p>
        </div>

        <a
          href="#inquiry-form"
          className="block w-full text-center px-6 py-3 bg-gradient-to-r from-margarita to-teal text-white rounded-lg hover:shadow-lg hover:shadow-margarita/30 transform hover:-translate-y-1 transition-all duration-300 font-semibold"
        >
          Inquire about this machine
        </a>
      </div>
    </div>
  );
}

import Image from "next/image";
import { MachineType } from "@/types";

interface MachineCardProps {
  machineType: MachineType;
  name: string;
  capacity: 15 | 30 | 45;
  basePrice: number;
  isSelected: boolean;
  isAvailable?: boolean;
  isPopular?: boolean;
  onSelect: (machineType: MachineType) => void;
  image: string;
  description: string;
  guestRange?: { min: number; max: number };
}

export default function MachineCard({
  machineType,
  name,
  capacity,
  basePrice,
  isSelected,
  isAvailable = true,
  isPopular = false,
  onSelect,
  image,
  description,
  guestRange,
}: MachineCardProps) {
  return (
    <button
      type="button"
      onClick={() => isAvailable && onSelect(machineType)}
      disabled={!isAvailable}
      aria-label={`Select ${name}`}
      aria-pressed={isSelected}
      className={`relative w-full p-3 rounded-xl border-2 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-margarita/50 ${
        isSelected
          ? "border-margarita bg-margarita/10 shadow-lg shadow-margarita/20"
          : "border-gray-200 dark:border-gray-600 hover:border-margarita/50"
      } ${!isAvailable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {isPopular && (
        <span className="absolute top-2 right-2 bg-margarita text-white text-xs px-2 py-0.5 rounded-full font-bold z-10">
          POPULAR
        </span>
      )}

      <div className="relative w-full aspect-square mb-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover rounded-lg"
        />
      </div>

      <h3 className="font-bold text-charcoal dark:text-white text-sm leading-tight">
        {name}
      </h3>

      {guestRange && (
        <p className="text-xs text-charcoal/60 dark:text-white/60 mt-1">
          {guestRange.min}–{guestRange.max} guests
        </p>
      )}

      <p className="text-xs text-charcoal/70 dark:text-white/70 mt-1 line-clamp-2">
        {description}
      </p>

      <p className="text-margarita font-bold text-sm mt-2">
        ${basePrice.toFixed(2)}
        <span className="text-xs font-normal text-charcoal/50 dark:text-white/50">
          /day
        </span>
      </p>

      {!isAvailable && (
        <span className="text-xs text-red-500 mt-1 block font-medium">
          Unavailable
        </span>
      )}

      <div
        className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          isSelected
            ? "border-margarita bg-margarita"
            : "border-gray-300 dark:border-gray-500"
        }`}
      >
        {isSelected && (
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </div>
    </button>
  );
}

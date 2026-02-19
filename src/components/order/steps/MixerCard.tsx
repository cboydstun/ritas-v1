import { MixerType } from "@/lib/rental-data";

interface MixerCardProps {
  mixerType: MixerType | null;
  name: string;
  price: number;
  description: string;
  isSelected: boolean;
  tankIndex: number;
  checkboxId: string;
  onChange: (mixerType: MixerType | null, tankIndex: number) => void;
}

export default function MixerCard({
  mixerType,
  name,
  price,
  description,
  isSelected,
  tankIndex,
  checkboxId,
  onChange,
}: MixerCardProps) {
  const isNoMixer = mixerType === null;

  return (
    <div className="relative">
      <input
        type="checkbox"
        id={checkboxId}
        aria-label={name}
        checked={isSelected}
        onChange={() => onChange(mixerType, tankIndex)}
        className="sr-only peer"
      />
      <label
        htmlFor={checkboxId}
        className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-margarita/50 ${
          isSelected
            ? "border-margarita bg-margarita/10 shadow-sm"
            : "border-gray-200 dark:border-gray-600 hover:border-margarita/40"
        }`}
      >
        {/* Visual checkbox indicator */}
        <div
          className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-all ${
            isSelected
              ? "border-margarita bg-margarita"
              : "border-gray-400 dark:border-gray-500"
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`text-sm font-medium ${
                isNoMixer
                  ? "text-charcoal/70 dark:text-white/70 italic"
                  : "text-charcoal dark:text-white"
              }`}
            >
              {name}
            </span>
            {!isNoMixer && price > 0 && (
              <span className="text-sm text-margarita font-bold flex-shrink-0">
                +${price.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-xs text-charcoal/60 dark:text-white/60 mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </label>
    </div>
  );
}

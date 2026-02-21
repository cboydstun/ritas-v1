import { type OrderStep } from "./types";

interface NavigationButtonsProps {
  currentStep: OrderStep;
  onPrevious: () => void;
  onNext: () => void;
}

// Context-aware labels so users know exactly what comes next
const nextStepLabels: Record<OrderStep, string> = {
  date: "Choose Your Machine",
  machine: "Enter Your Details",
  details: "Browse Party Extras",
  extras: "Review Your Order",
  review: "Confirm", // hidden on review — ReviewStep has its own Confirm button
};

export function NavigationButtons({
  currentStep,
  onPrevious,
  onNext,
}: NavigationButtonsProps) {
  return (
    <div className="flex justify-between items-end mt-8">
      {/* Previous button */}
      <button
        onClick={onPrevious}
        className={`px-8 py-3 rounded-xl font-bold transition-all duration-300 ${
          currentStep === "date"
            ? "invisible"
            : "bg-light dark:bg-charcoal/30 text-charcoal dark:text-white hover:bg-light/80 dark:hover:bg-charcoal/50 hover:-translate-y-1"
        }`}
      >
        Previous
      </button>

      {/* Next / Skip area */}
      <div className="flex flex-col items-end gap-2">
        {/* Main next button — hidden on review step (ReviewStep has its own Confirm button) */}
        <button
          onClick={onNext}
          className={`px-8 py-3 bg-gradient-to-r from-orange to-pink text-white rounded-xl font-bold
            hover:shadow-lg hover:shadow-orange/30 transform hover:-translate-y-1 transition-all duration-300
            ${currentStep === "review" ? "hidden" : ""}`}
        >
          {nextStepLabels[currentStep]} →
        </button>

        {/* Skip link — only shown on the Extras step so users know it's optional */}
        {currentStep === "extras" && (
          <button
            onClick={onNext}
            className="text-sm text-charcoal/50 dark:text-white/50 hover:text-charcoal/70 dark:hover:text-white/70 transition-colors underline-offset-2 hover:underline"
          >
            Skip — no extras needed
          </button>
        )}
      </div>
    </div>
  );
}

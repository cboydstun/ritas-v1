import { type OrderStep } from "./types";

interface NavigationButtonsProps {
  currentStep: OrderStep;
  onPrevious: () => void;
  onNext: () => void;
  isNextDisabled?: boolean;
}

export function NavigationButtons({
  currentStep,
  onPrevious,
  onNext,
  isNextDisabled = false,
}: NavigationButtonsProps) {
  return (
    <div className="flex justify-between mt-8">
      <button
        onClick={onPrevious}
        className={`px-8 py-3 rounded-xl font-bold transition-all duration-300 ${
          currentStep === "delivery"
            ? "invisible"
            : "bg-light dark:bg-charcoal/30 text-charcoal dark:text-white hover:bg-light/80 dark:hover:bg-charcoal/50 hover:-translate-y-1"
        }`}
      >
        Previous
      </button>
      <button
        onClick={onNext}
        disabled={isNextDisabled}
        className={`px-8 py-3 bg-gradient-to-r from-orange to-pink text-white rounded-xl font-bold
   hover:shadow-lg hover:shadow-orange/30 transform hover:-translate-y-1 transition-all duration-300
   ${currentStep === "review" ? "hidden" : ""}
   ${isNextDisabled ? "opacity-50 cursor-not-allowed hover:transform-none hover:shadow-none" : ""}`}
      >
        Next Step
      </button>
    </div>
  );
}

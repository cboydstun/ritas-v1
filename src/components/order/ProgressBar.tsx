import { type OrderStep, steps } from "./types";

interface ProgressBarProps {
  currentStep: OrderStep;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const progress = (currentIndex / (steps.length - 1)) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 px-4">
      {/* Step counter */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-charcoal/70 dark:text-white/70">
          Step {currentIndex + 1} of {steps.length}
        </span>
        <span className="text-sm font-semibold text-orange">
          {steps[currentIndex].label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-light dark:bg-charcoal/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange to-pink transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step labels */}
      <div className="flex justify-between mt-2">
        {steps.map((step) => (
          <span
            key={step.id}
            className={`text-xs md:text-sm transition-colors duration-300 ${
              currentStep === step.id
                ? "text-orange font-medium"
                : "text-charcoal/50 dark:text-white/50"
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}

import { type OrderStep, steps } from "./types";

interface ProgressBarProps {
  currentStep: OrderStep;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  // Defence in depth: OrderForm validates the restored draft step, but an
  // index of -1 here used to throw on `steps[-1].label` and take the whole
  // order page down.
  const foundIndex = steps.findIndex((s) => s.id === currentStep);
  const currentIndex = foundIndex === -1 ? 0 : foundIndex;
  const progress = (currentIndex / (steps.length - 1)) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 px-4">
      {/* Step counter */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-charcoal/70 dark:text-white/70">
          Step {currentIndex + 1} of {steps.length}
        </span>
        <span className="text-sm font-semibold text-orange">
          {steps[currentIndex]?.label ?? currentStep}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-light dark:bg-charcoal/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-orange to-pink transition-all duration-300"
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

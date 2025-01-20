import { type OrderStep, steps } from "./types";

interface ProgressBarProps {
  currentStep: OrderStep;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center">
        {steps.map((s, index) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                steps.findIndex((st) => st.id === currentStep) >= index
                  ? "bg-gradient-to-r from-orange to-pink text-white"
                  : "bg-light dark:bg-charcoal/30 text-charcoal/50 dark:text-white/50"
              }`}
            >
              {index + 1}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-1 w-[80px] md:w-[200px] lg:w-[200px] ${
                  steps.findIndex((st) => st.id === currentStep) > index
                    ? "bg-gradient-to-r from-orange to-pink"
                    : "bg-light dark:bg-charcoal/30"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {steps.map((s) => (
          <div
            key={s.id}
            className={`text-sm ${
              currentStep === s.id
                ? "text-orange font-medium"
                : "text-charcoal/50 dark:text-white/50"
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

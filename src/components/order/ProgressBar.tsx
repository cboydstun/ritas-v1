import { type OrderStep, steps } from "./types";

interface ProgressBarProps {
  currentStep: OrderStep;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="w-full max-w-4xl mx-auto mb-8 px-4">
      <div className="relative flex items-center">
        {/* Progress line background */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-light dark:bg-charcoal/30" />
        
        {/* Active progress line */}
        <div 
          className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-gradient-to-r from-orange to-pink transition-all duration-300"
          style={{
            width: `${(steps.findIndex((s) => s.id === currentStep) / (steps.length - 1)) * 100}%`
          }}
        />

        {/* Step circles with labels */}
        <div className="relative flex justify-between w-full">
          {steps.map((step, index) => {
            const isActive = steps.findIndex((s) => s.id === currentStep) >= index;
            return (
              <div 
                key={step.id} 
                className="flex flex-col items-center"
              >
                <div
                  className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center z-10 transition-all duration-300 text-xs md:text-sm ${
                    isActive
                      ? "bg-gradient-to-r from-orange to-pink text-white"
                      : "bg-light dark:bg-charcoal/30 text-charcoal/50 dark:text-white/50"
                  }`}
                >
                  {index + 1}
                </div>
                <span 
                  className={`mt-2 text-[10px] md:text-sm text-center transition-colors duration-300 max-w-[70px] md:max-w-none ${
                    currentStep === step.id
                      ? "text-orange font-medium"
                      : "text-charcoal/50 dark:text-white/50"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

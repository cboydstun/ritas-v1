import { type OrderStep, steps } from "./types";

interface ProgressBarProps {
  currentStep: OrderStep;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
    return (
        <div className="w-full max-w-4xl mx-auto mb-8 px-4">
          <div className="relative flex items-center">
            {/* Progress line background */}
            <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-light dark:bg-charcoal/30" />
            
            {/* Active progress line */}
            <div 
              className="absolute top-1/2 left-0 h-1 -translate-y-1/2 bg-gradient-to-r from-orange to-pink transition-all duration-300"
              style={{
                width: `${(steps.findIndex((s) => s.id === currentStep) / (steps.length - 1)) * 100}%`
              }}
            />
    
            {/* Step circles */}
            <div className="relative flex justify-between w-full">
              {steps.map((step, index) => (
                <div 
                  key={step.id} 
                  className="flex flex-col items-center"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                      steps.findIndex((s) => s.id === currentStep) >= index
                        ? "bg-gradient-to-r from-orange to-pink text-white"
                        : "bg-light dark:bg-charcoal/30 text-charcoal/50 dark:text-white/50"
                    }`}
                  >
                    {index + 1}
                  </div>
                  {step.label && (
                    <span className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {step.label}
                    </span>
                  )}
                </div>
              ))}
              </div>
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

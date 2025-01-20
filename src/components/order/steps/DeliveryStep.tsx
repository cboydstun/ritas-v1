import Image from "next/image";
import { StepProps, inputClassName, labelClassName } from "../types";

export function DeliveryStep({ formData, onInputChange, error }: StepProps) {
  return (
    <div className="space-y-8 relative">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
          Select Your Machine
        </h2>
        <p className="text-charcoal/70 dark:text-white/70">
          Choose your perfect frozen drink machine setup
        </p>
      </div>

      <div className="space-y-6">
        <div className="relative w-full h-[40em] mb-4">
          <Image
            src={
              formData.machineType === "single"
                ? "/vevor-15l-slushy.jpg"
                : "/vevor-30l-slushy.webp"
            }
            alt={`${formData.capacity}L ${formData.machineType === "single" ? "Single" : "Double"} Tank Machine`}
            fill
            className="object-cover rounded-lg"
            priority
          />
        </div>

        <div>
          <label className={labelClassName}>Machine Type</label>
          <select
            name="machineType"
            value={formData.machineType}
            onChange={onInputChange}
            className={inputClassName}
          >
            <option value="single">15L Single Tank Machine</option>
            <option value="double">30L Double Tank Machine</option>
          </select>
          <p className="mt-2 text-sm text-charcoal/70 dark:text-white/70">
            {formData.machineType === "single"
              ? "Perfect for smaller gatherings and parties"
              : "Ideal for larger events and multiple flavors"}
          </p>
        </div>

        <div>
          <label className={labelClassName}>Mixer Type</label>
          <select
            name="mixerType"
            value={formData.mixerType}
            onChange={onInputChange}
            className={inputClassName}
          >
            <option value="none">No Mixer</option>
            <option value="kool-aid">Kool-Aid Mixer</option>
            <option value="margarita">Margarita Mixer</option>
            <option value="pina-colada">Piña Colada Mixer</option>
          </select>
          <p className="mt-2 text-sm text-charcoal/70 dark:text-white/70">
            {formData.mixerType === "none"
              ? "Bring your own mixer for complete control over your drinks"
              : formData.mixerType === "kool-aid"
                ? "Non-alcoholic, perfect for family events"
                : formData.mixerType === "margarita"
                  ? "Classic margarita mix, just add tequila"
                  : "Tropical piña colada mix, just add rum"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>Delivery Date</label>
            <input
              type="date"
              name="rentalDate"
              value={formData.rentalDate}
              onChange={onInputChange}
              className={inputClassName}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div>
            <label className={labelClassName}>Delivery Time</label>
            <input
              type="time"
              name="rentalTime"
              value={formData.rentalTime}
              onChange={onInputChange}
              className={inputClassName}
              min="08:00"
              max="18:00"
              step="3600"
            />
          </div>

          <div>
            <label className={labelClassName}>Pick Up Date</label>
            <input
              type="date"
              name="returnDate"
              value={formData.returnDate}
              onChange={onInputChange}
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Pick Up Time</label>
            <input
              type="time"
              name="returnTime"
              value={formData.returnTime}
              onChange={onInputChange}
              className={inputClassName}
              min="08:00"
              max="18:00"
              step="3600"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-xl font-bold text-orange">
            Total: ${formData.price}
          </p>
        </div>
      </div>
    </div>
  );
}

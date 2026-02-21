import { ChangeEvent, useState } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { format, addDays, startOfDay, parseISO } from "date-fns";
import { StepProps, labelClassName, inputClassName } from "../types";
import "react-day-picker/dist/style.css";

export default function DateSelectionStep({
  formData,
  onInputChange,
  error,
}: StepProps) {
  // Issue 2: use parseISO so the calendar always shows the correct local date
  // (new Date("YYYY-MM-DD") parses as UTC midnight, which can show the wrong day)
  const [range, setRange] = useState<DateRange | undefined>({
    from: formData.rentalDate ? parseISO(formData.rentalDate) : undefined,
    to: formData.returnDate ? parseISO(formData.returnDate) : undefined,
  });

  // Helper function to create a synthetic event
  const createSyntheticEvent = (name: string, value: string) => {
    return {
      target: { name, value },
    } as unknown as ChangeEvent<HTMLInputElement>;
  };

  // Disable past dates
  const disabledDays = {
    before: startOfDay(new Date()),
  };

  const handleRangeSelect = (newRange: DateRange | undefined) => {
    setRange(newRange);

    if (newRange?.from) {
      const fromString = format(newRange.from, "yyyy-MM-dd");
      onInputChange(createSyntheticEvent("rentalDate", fromString));

      if (newRange.to) {
        const toString = format(newRange.to, "yyyy-MM-dd");
        onInputChange(createSyntheticEvent("returnDate", toString));
      } else {
        // Auto-suggest next day if only start date selected
        const nextDay = addDays(newRange.from, 1);
        const nextDayString = format(nextDay, "yyyy-MM-dd");
        onInputChange(createSyntheticEvent("returnDate", nextDayString));
      }
    }
  };

  return (
    <div className="space-y-8 relative">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-2">
          When do you need the machine?
        </h2>
        <p className="text-charcoal/70 dark:text-white/70">
          Select your delivery and pickup dates on the calendar
        </p>
      </div>

      <div className="space-y-6">
        {/* Single Calendar with Range Selection */}
        <div className="bg-white dark:bg-charcoal/30 p-6 rounded-xl">
          <div className="flex justify-center">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={handleRangeSelect}
              disabled={disabledDays}
              className="rdp-custom"
              numberOfMonths={1}
            />
          </div>
          <div className="mt-4 text-center text-sm text-charcoal/70 dark:text-white/70">
            <p>
              📅 Click to select delivery date, then click again for pickup date
            </p>
          </div>
        </div>

        {/* Time Selection - Show after delivery date is selected (return time after both) */}
        {range?.from && (
          <div className="bg-white dark:bg-charcoal/30 p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-charcoal dark:text-white mb-4 text-center">
              Select Times
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClassName}>Delivery Time</label>
                <select
                  name="rentalTime"
                  value={formData.rentalTime}
                  onChange={onInputChange}
                  className={inputClassName}
                >
                  <option value="ANY">ANY TIME</option>
                  <option value="08:00">8:00 AM</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="16:00">4:00 PM</option>
                  <option value="17:00">5:00 PM</option>
                  <option value="18:00">6:00 PM</option>
                </select>
              </div>

              <div>
                <label className={labelClassName}>Pick Up Time</label>
                <select
                  name="returnTime"
                  value={formData.returnTime}
                  onChange={onInputChange}
                  className={inputClassName}
                >
                  <option value="ANY">ANY TIME</option>
                  <option value="08:00">8:00 AM</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="16:00">4:00 PM</option>
                  <option value="17:00">5:00 PM</option>
                  <option value="18:00">6:00 PM</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Selected Dates Summary */}
        {range?.from &&
          range?.to &&
          formData.rentalTime &&
          formData.returnTime && (
            <div className="bg-margarita/10 dark:bg-margarita/20 p-6 rounded-xl border-2 border-margarita/30">
              <h3 className="text-lg font-semibold text-charcoal dark:text-white mb-4 text-center">
                Your Rental Period
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-charcoal/70 dark:text-white/70">
                    📍 Delivery:
                  </span>
                  <span className="font-medium text-charcoal dark:text-white">
                    {format(range.from, "EEEE, MMMM d, yyyy")} at{" "}
                    {formData.rentalTime === "ANY"
                      ? "Any Time"
                      : formData.rentalTime}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-charcoal/70 dark:text-white/70">
                    📍 Pickup:
                  </span>
                  <span className="font-medium text-charcoal dark:text-white">
                    {format(range.to, "EEEE, MMMM d, yyyy")} at{" "}
                    {formData.returnTime === "ANY"
                      ? "Any Time"
                      : formData.returnTime}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-margarita/30">
                <p className="text-sm text-charcoal/70 dark:text-white/70 text-center">
                  ✨ 24-hour rental period included
                </p>
                <p className="text-sm text-charcoal/70 dark:text-white/70 text-center">
                  🚚 Free delivery in Bexar County
                </p>
              </div>
            </div>
          )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

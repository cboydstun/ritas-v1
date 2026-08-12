import { ChangeEvent, useEffect, useState } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { format, addDays, startOfDay, parseISO } from "date-fns";
import { StepProps, labelClassName, inputClassName } from "../types";
import "react-day-picker/dist/style.css";

function formatHour(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h === 12) return "12:00 PM";
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
}

function generateTimeOptions(startHour: number, endHour: number) {
  const options: { value: string; label: string }[] = [];
  for (let h = startHour; h <= endHour; h++) {
    options.push({
      value: `${String(h).padStart(2, "0")}:00`,
      label: formatHour(h),
    });
  }
  return options;
}

export default function DateSelectionStep({
  formData,
  onInputChange,
  error,
  deliveryWindowStartHour = 8,
  deliveryWindowEndHour = 18,
}: StepProps) {
  const timeOptions = generateTimeOptions(
    deliveryWindowStartHour,
    deliveryWindowEndHour,
  );
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

  // Follow formData when the parent changes it — "Start fresh" clears the
  // draft while this step stays mounted, and the calendar used to keep showing
  // the old range while "Next" errored "Please select a delivery date".
  useEffect(() => {
    setRange({
      from: formData.rentalDate ? parseISO(formData.rentalDate) : undefined,
      to: formData.returnDate ? parseISO(formData.returnDate) : undefined,
    });
  }, [formData.rentalDate, formData.returnDate]);

  // Disable past dates
  const disabledDays = {
    before: startOfDay(new Date()),
  };

  const handleRangeSelect = (newRange: DateRange | undefined) => {
    setRange(newRange);

    // DayPicker passes undefined when the user clicks to clear the range.
    // Leaving formData alone meant the calendar showed nothing selected while
    // the wizard happily advanced on the previous dates.
    if (!newRange?.from) {
      onInputChange(createSyntheticEvent("rentalDate", ""));
      onInputChange(createSyntheticEvent("returnDate", ""));
      return;
    }

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
                <label htmlFor="rentalTime" className={labelClassName}>
                  Delivery Time
                </label>
                <select
                  id="rentalTime"
                  name="rentalTime"
                  value={formData.rentalTime}
                  onChange={onInputChange}
                  className={inputClassName}
                >
                  <option value="ANY">ANY TIME</option>
                  {timeOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="returnTime" className={labelClassName}>
                  Pick Up Time
                </label>
                <select
                  id="returnTime"
                  name="returnTime"
                  value={formData.returnTime}
                  onChange={onInputChange}
                  className={inputClassName}
                >
                  <option value="ANY">ANY TIME</option>
                  {timeOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
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
                {/* Not "free": computeOrderTotal adds a flat delivery fee to
                    every order, and PricingSummary shows it two screens later. */}
                <p className="text-sm text-charcoal/70 dark:text-white/70 text-center">
                  🚚 Flat-rate delivery &amp; setup throughout Bexar County
                </p>
              </div>
            </div>
          )}

        {error && (
          <div
            role="alert"
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

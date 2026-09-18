import { ChangeEvent, useMemo } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { format, addDays, startOfDay, parseISO } from "date-fns";
import { StepProps, labelClassName, inputClassName } from "../types";
import {
  DEFAULT_SPECIFIC_TIME_FEE,
  FLEXIBLE_TIME,
  formatDeliveryTime,
  isSpecificTime,
  resolveSpecificTimeCharge,
  specificTimeFeeNote,
} from "@/lib/specific-time-charge";
// v10 moved the stylesheet out of dist/; the old path still resolves through
// a fallback in the package exports map, but this is the documented one.
// globals.css styles the picker through the rdp-* class names and CSS custom
// properties, which v10 kept unchanged from v9 — a rename there is silent,
// which is what the v8 -> v9 note in globals.css records.
import "react-day-picker/style.css";

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

type LegField = "rentalTime" | "returnTime";

const LEG_COPY: Record<
  LegField,
  { legend: string; flexibleBlurb: (window: string) => string; noun: string }
> = {
  rentalTime: {
    legend: "Delivery time",
    flexibleBlurb: (window) =>
      `We'll deliver during our ${window} window and have it set up before your event starts.`,
    noun: "delivery",
  },
  returnTime: {
    legend: "Pickup time",
    flexibleBlurb: (window) =>
      `We'll pick up during our ${window} window on your pickup date.`,
    noun: "pickup",
  },
};

const cardClassName =
  "flex cursor-pointer gap-3 rounded-lg border-2 border-charcoal/15 dark:border-white/20 p-4 transition-colors has-checked:border-margarita has-checked:bg-margarita/10 dark:has-checked:border-margarita-dark dark:has-checked:bg-margarita/20 has-focus-visible:ring-2 has-focus-visible:ring-margarita";

/**
 * One leg — delivery or pickup — as two cards: flexible (free) or a specific
 * clock time (charged). Ported from bounce-v3's `StepTimeLeg`.
 *
 * The preference is not a field of its own: a flexible leg is the stored time
 * `"ANY"`, so choosing a card writes the time directly. The fee shown comes
 * from the same `Settings.fees` figure `computeOrderTotal` prices with.
 */
function TimeLeg({
  field,
  value,
  fee,
  windowLabel,
  timeOptions,
  onChange,
}: {
  field: LegField;
  value: string;
  fee: number;
  windowLabel: string;
  timeOptions: { value: string; label: string }[];
  onChange: (name: string, value: string) => void;
}) {
  const copy = LEG_COPY[field];
  const specific = isSpecificTime(value);
  const radioName = `${field}Preference`;

  return (
    <fieldset className="space-y-3">
      <legend className={labelClassName}>{copy.legend}</legend>

      <label className={cardClassName}>
        <input
          type="radio"
          name={radioName}
          checked={!specific}
          onChange={() => onChange(field, FLEXIBLE_TIME)}
          className="mt-1 accent-margarita"
        />
        <span>
          <span className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-semibold text-charcoal dark:text-white">
              Any time
            </span>
            <span className="text-sm font-medium text-margarita dark:text-margarita-dark">
              Free
            </span>
          </span>
          <span className="block text-sm text-charcoal/70 dark:text-white/70">
            {copy.flexibleBlurb(windowLabel)}
          </span>
        </span>
      </label>

      <label className={cardClassName}>
        <input
          type="radio"
          name={radioName}
          checked={specific}
          // The window's first hour, which is always a valid option.
          onChange={() => onChange(field, timeOptions[0]?.value ?? "")}
          className="mt-1 accent-margarita"
        />
        <span>
          <span className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-semibold text-charcoal dark:text-white">
              Specific time
            </span>
            <span className="text-sm font-medium text-charcoal dark:text-white">
              {specificTimeFeeNote(fee)}
            </span>
          </span>
          <span className="block text-sm text-charcoal/70 dark:text-white/70">
            We plan our day around your exact {copy.noun} time.
          </span>
        </span>
      </label>

      {specific && (
        <div>
          <label htmlFor={field} className="sr-only">
            {`Choose a ${copy.noun} time`}
          </label>
          <select
            id={field}
            name={field}
            value={value}
            onChange={(e) => onChange(field, e.target.value)}
            className={inputClassName}
          >
            {timeOptions.map(({ value: v, label }) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  );
}

export default function DateSelectionStep({
  formData,
  onInputChange,
  error,
  deliveryWindowStartHour = 8,
  deliveryWindowEndHour = 18,
  specificDeliveryTimeFee = DEFAULT_SPECIFIC_TIME_FEE,
  specificPickupTimeFee = DEFAULT_SPECIFIC_TIME_FEE,
}: StepProps) {
  const timeOptions = generateTimeOptions(
    deliveryWindowStartHour,
    deliveryWindowEndHour,
  );
  const windowLabel = `${formatHour(deliveryWindowStartHour)} – ${formatHour(
    deliveryWindowEndHour,
  )}`;
  const specificTimeCharge = resolveSpecificTimeCharge({
    rentalTime: formData.rentalTime,
    returnTime: formData.returnTime,
    specificDeliveryTimeFee,
    specificPickupTimeFee,
  });
  // Helper function to create a synthetic event
  const createSyntheticEvent = (name: string, value: string) => {
    return {
      target: { name, value },
    } as unknown as ChangeEvent<HTMLInputElement>;
  };

  // Derived, not mirrored. `handleRangeSelect` writes both dates to the parent
  // on every path, so the parent is already the only source of truth — the
  // local copy plus a sync effect meant each calendar click re-parsed and
  // re-rendered twice. Deriving also keeps "Start fresh" working, which is
  // what the effect was there for.
  //
  // Issue 2: use parseISO so the calendar always shows the correct local date
  // (new Date("YYYY-MM-DD") parses as UTC midnight, which can show the wrong day)
  const range: DateRange | undefined = useMemo(
    () => ({
      from: formData.rentalDate ? parseISO(formData.rentalDate) : undefined,
      to: formData.returnDate ? parseISO(formData.returnDate) : undefined,
    }),
    [formData.rentalDate, formData.returnDate],
  );

  // Disable past dates
  const disabledDays = {
    before: startOfDay(new Date()),
  };

  const handleRangeSelect = (newRange: DateRange | undefined) => {
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TimeLeg
                field="rentalTime"
                value={formData.rentalTime}
                fee={specificDeliveryTimeFee}
                windowLabel={windowLabel}
                timeOptions={timeOptions}
                onChange={(name, value) =>
                  onInputChange(createSyntheticEvent(name, value))
                }
              />
              <TimeLeg
                field="returnTime"
                value={formData.returnTime}
                fee={specificPickupTimeFee}
                windowLabel={windowLabel}
                timeOptions={timeOptions}
                onChange={(name, value) =>
                  onInputChange(createSyntheticEvent(name, value))
                }
              />
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
                    {formatDeliveryTime(formData.rentalTime)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-charcoal/70 dark:text-white/70">
                    📍 Pickup:
                  </span>
                  <span className="font-medium text-charcoal dark:text-white">
                    {format(range.to, "EEEE, MMMM d, yyyy")} at{" "}
                    {formatDeliveryTime(formData.returnTime)}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-margarita/30">
                <p className="text-sm text-charcoal/70 dark:text-white/70 text-center">
                  ✨ 24-hour rental period included
                </p>
                {specificTimeCharge > 0 && (
                  <p className="text-sm text-charcoal/70 dark:text-white/70 text-center">
                    ⏰ Specific-time fee:{" "}
                    {specificTimeFeeNote(specificTimeCharge)}
                  </p>
                )}
                {/* Two terms, and this line used to name neither. Every order
                    pays the delivery and setup fee, and the distance surcharge
                    on top varies with how far the truck drives. Both appear
                    under the address field on the next step and again in
                    PricingSummary; no figure is quoted here because this step
                    has no ZIP yet. */}
                <p className="text-sm text-charcoal/70 dark:text-white/70 text-center">
                  🚚 Delivery, setup and pickup — fee and ZIP surcharge quoted
                  on the next step
                </p>
              </div>
            </div>
          )}

        {error && (
          <div
            role="alert"
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-sm relative"
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

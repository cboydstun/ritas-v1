import { ChangeEvent, useMemo } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { format, addDays, startOfDay, parseISO } from "date-fns";
import { StepProps, labelClassName, inputClassName } from "../types";
import {
  DEFAULT_SPECIFIC_TIME_FEE,
  formatDeliveryTime,
  formatLegTime,
  resolveSpecificTimeCharge,
  specificTimeFeeNote,
  type TimePreference,
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

const PREFERENCE_FIELD = {
  rentalTime: "rentalTimePreference",
  returnTime: "returnTimePreference",
} as const satisfies Record<LegField, string>;

const LEG_COPY: Record<
  LegField,
  {
    legend: string;
    noun: string;
    flexibleBlurb: (time: string) => string;
  }
> = {
  rentalTime: {
    legend: "Preferred delivery time",
    noun: "delivery",
    flexibleBlurb: (time) =>
      `We'll arrive at or before ${time}, so the machine is ready when your party starts.`,
  },
  returnTime: {
    legend: "Preferred pickup time",
    noun: "pickup",
    flexibleBlurb: (time) =>
      `We'll pick up at or after ${time}, so you keep it as long as your party needs it.`,
  },
};

const cardClassName =
  "flex cursor-pointer gap-3 rounded-lg border-2 border-charcoal/15 dark:border-white/20 p-4 transition-colors has-checked:border-margarita has-checked:bg-margarita/10 dark:has-checked:border-margarita-dark dark:has-checked:bg-margarita/20 has-focus-visible:ring-2 has-focus-visible:ring-margarita";

/**
 * One leg — delivery or pickup: a required preferred time, then how firm it
 * is. Flexible (free) means delivery at or before that time and pickup at or
 * after it; specific (charged) means exactly then. Ported from bounce-v3's
 * `StepTimeLeg`, whose shape this now matches: a clock time plus a stored
 * preference. There is no "any time" — the crew always knows when the
 * customer needs the machine.
 *
 * The fee shown comes from the same `Settings.fees` figure
 * `computeOrderTotal` prices with.
 */
function TimeLeg({
  field,
  value,
  preference,
  fee,
  timeOptions,
  onChange,
}: {
  field: LegField;
  value: string;
  preference: TimePreference;
  fee: number;
  timeOptions: { value: string; label: string }[];
  onChange: (name: string, value: string) => void;
}) {
  const copy = LEG_COPY[field];
  const preferenceField = PREFERENCE_FIELD[field];
  const timeLabel = value ? formatDeliveryTime(value) : "your preferred time";

  return (
    <fieldset className="space-y-3">
      <legend className={labelClassName}>{copy.legend}</legend>

      <div>
        <label htmlFor={field} className="sr-only">
          {copy.legend}
        </label>
        <select
          id={field}
          name={field}
          value={value}
          required
          onChange={(e) => onChange(field, e.target.value)}
          className={inputClassName}
        >
          <option value="" disabled>
            Choose a time…
          </option>
          {timeOptions.map(({ value: v, label }) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <label className={cardClassName}>
        <input
          type="radio"
          name={preferenceField}
          checked={preference !== "specific"}
          onChange={() => onChange(preferenceField, "flexible")}
          className="mt-1 accent-margarita"
        />
        <span>
          <span className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-semibold text-charcoal dark:text-white">
              Flexible
            </span>
            <span className="text-sm font-medium text-margarita dark:text-margarita-dark">
              Free
            </span>
          </span>
          <span className="block text-sm text-charcoal/70 dark:text-white/70">
            {copy.flexibleBlurb(timeLabel)}
          </span>
        </span>
      </label>

      <label className={cardClassName}>
        <input
          type="radio"
          name={preferenceField}
          checked={preference === "specific"}
          onChange={() => onChange(preferenceField, "specific")}
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
            {`We'll plan our day around arriving at exactly ${timeLabel} for your ${copy.noun}.`}
          </span>
        </span>
      </label>
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
  const specificTimeCharge = resolveSpecificTimeCharge({
    rentalTime: formData.rentalTime,
    returnTime: formData.returnTime,
    rentalTimePreference: formData.rentalTimePreference,
    returnTimePreference: formData.returnTimePreference,
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
                preference={formData.rentalTimePreference}
                fee={specificDeliveryTimeFee}
                timeOptions={timeOptions}
                onChange={(name, value) =>
                  onInputChange(createSyntheticEvent(name, value))
                }
              />
              <TimeLeg
                field="returnTime"
                value={formData.returnTime}
                preference={formData.returnTimePreference}
                fee={specificPickupTimeFee}
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
                    {format(range.from, "EEEE, MMMM d, yyyy")}{" "}
                    {formatLegTime(
                      "delivery",
                      formData.rentalTime,
                      formData.rentalTimePreference,
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-charcoal/70 dark:text-white/70">
                    📍 Pickup:
                  </span>
                  <span className="font-medium text-charcoal dark:text-white">
                    {format(range.to, "EEEE, MMMM d, yyyy")}{" "}
                    {formatLegTime(
                      "pickup",
                      formData.returnTime,
                      formData.returnTimePreference,
                    )}
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

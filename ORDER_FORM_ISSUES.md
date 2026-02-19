Here are **4 concrete issues** to fix, in order of severity:

---

## Issue 1 — Multi-mixer pricing uses wrong multiplier logic (CORRECTNESS BUG)

**Problem:** `calculatePrice(machineType, mixerType)` accepts only **one** mixer type and then multiplies it by the number of tanks (`mixerMultiplier = 1/2/3`). This means for a double machine with Tank 1 = Margarita ($19.95) and Tank 2 = Piña Colada ($24.95), it calculates `2 × $19.95 = $39.90` instead of the correct `$19.95 + $24.95 = $44.90`. Every price display in the app is affected: `PricingSummary`, `ReviewStep`, and `OrderForm`'s initial price state — all call `calculatePrice(..., selectedMixers[0])`.

**Fix plan:**

- Update `calculatePrice` in `lib/pricing.ts` to accept a `MixerType[]` (array) instead of a single `MixerType?`, and sum each mixer's individual price rather than multiplying
- Update all callers (`OrderForm`, `PricingSummary`, `ReviewStep`) to pass `formData.selectedMixers` instead of `formData.selectedMixers[0]`
- Update the return type `PriceBreakdown` to keep `mixerPrice` as the total of all mixers combined (no API surface change needed)

---

## Issue 2 — Date timezone bug causing off-by-one dates (CORRECTNESS BUG)

**Problem:** In JavaScript, `new Date("2025-04-14")` (a bare ISO date string) is parsed as **UTC midnight**, not local midnight. In any timezone behind UTC (e.g., US/Central = UTC-5/6), this resolves to **April 13 at 7pm local time**, which means `rentalDays` calculations and displayed dates can be one day off.

Three places are affected:

1. `ReviewStep` — `new Date(formData.returnDate)` and `new Date(formData.rentalDate)` with no time suffix
2. `utils.ts` → `getNextDay()` — `new Date(value)` on a YYYY-MM-DD string
3. `DateSelectionStep` — initializes calendar range with `new Date(formData.rentalDate)` / `new Date(formData.returnDate)`

**Fix plan:**

- In `utils.ts` → `getNextDay`, append `T00:00:00` when constructing the Date from the input string
- In `ReviewStep`, append `T00:00:00` when constructing `new Date(formData.rentalDate)` and `new Date(formData.returnDate)` for the day-diff calculation (matching how `PricingSummary` already does it correctly)
- In `DateSelectionStep`, use `date-fns/parseISO` (already available via `date-fns`) instead of `new Date()` when initializing `range` from `formData`

---

## Issue 3 — `isServiceDiscount` double state (STATE MANAGEMENT BUG)

**Problem:** The service discount boolean lives in **two places** simultaneously: `OrderForm`'s own `isServiceDiscount` useState, and `formData.isServiceDiscount`. A `useEffect` keeps them in sync. This is fragile, adds unnecessary renders, and `ReviewStep`/`PricingSummary` both have their own logic to resolve which source wins (`formData.isServiceDiscount !== undefined ? formData.isServiceDiscount : isServiceDiscount`).

**Fix plan:**

- Remove the separate `isServiceDiscount` state from `OrderForm`
- Remove the `useEffect` that syncs it into `formData`
- Initialize `formData.isServiceDiscount` as `false` (not `undefined`)
- Update `ReviewStep`'s `setIsServiceDiscount` prop to directly update `formData` via `onInputChange` (or a dedicated setter passed down)
- Update `PricingSummary` and `ReviewStep` to read exclusively from `formData.isServiceDiscount`, removing the fallback/dual-source logic

---

## Issue 4 — Availability error is invisible until "Next" is clicked (UX BUG)

**Problem:** When `MachineStep` detects that a machine is unavailable, it calls `onAvailabilityError(msg)` which writes to a **ref** (`dateAvailabilityErrorRef.current`) in `OrderForm`. Because it's a ref and not state, **no re-render happens** and no error is shown to the user. The error only surfaces when the user clicks the "Next" button, which is surprising and potentially confusing.

**Fix plan:**

- In `OrderForm`, change `dateAvailabilityErrorRef` from a `useRef` to a `useState`
- Pass a setter callback to `MachineStep` via `onAvailabilityError` that sets the state (same interface, no `StepProps` type change needed)
- The error state will now drive both: (a) the existing "Next" button block, and (b) a visible error message that `MachineStep` already knows how to display via its `error` prop — so pass the availability error state down as the `error` prop when on the `"machine"` step

---

## Summary of files to change

| File                                           | Changes                                                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/pricing.ts`                               | `calculatePrice` accepts `MixerType[]`, sums per-tank prices                                                                                    |
| `components/order/utils.ts`                    | `getNextDay` appends `T00:00:00`                                                                                                                |
| `components/order/OrderForm.tsx`               | Remove `isServiceDiscount` state + `useEffect`; change `dateAvailabilityErrorRef` to state; pass availability error as `error` to `MachineStep` |
| `components/order/PricingSummary.tsx`          | Pass `selectedMixers` array to `calculatePrice`; read discount from `formData` only                                                             |
| `components/order/steps/ReviewStep.tsx`        | Pass `selectedMixers` array to `calculatePrice`; append `T00:00:00` on date construction; read discount from `formData` only                    |
| `components/order/steps/DateSelectionStep.tsx` | Use `parseISO` for range initialization                                                                                                         |

import { useState } from "react";
import { MachineType } from "@/types";

interface AvailabilityResponse {
  available: boolean;
  machineType: MachineType;
  capacity: 15 | 30 | 45;
  date: string;
}

interface AvailabilityResult extends AvailabilityResponse {
  error?: string;
}

/**
 * The `message` from an error response, or a fallback.
 *
 * A 502/504 answers with an HTML error page, and `response.json()` then threw
 * a SyntaxError that was rendered to the customer verbatim as
 * `Unexpected token '<' ... is not valid JSON`.
 */
async function errorMessageFrom(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.message === "string" ? body.message : fallback;
  } catch {
    return fallback;
  }
}

/**
 * How long to wait for `/api/v1/availability` before giving up.
 *
 * Without a bound, a hung request left every machine card on "loading" — and
 * therefore disabled — while `handleNextStep` kept answering "Still checking
 * availability for your dates". The customer could not check out and had no
 * escape hatch. A timeout resolves into the existing soft error state, which
 * already lets them continue and be confirmed by phone.
 */
const AVAILABILITY_TIMEOUT_MS = 8000;

export function useAvailabilityCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = async (
    machineType: MachineType,
    capacity: 15 | 30 | 45,
    date: string,
    returnDate?: string,
  ): Promise<AvailabilityResult> => {
    setIsChecking(true);
    setError(null);

    try {
      const returnDateQuery = returnDate ? `&returnDate=${returnDate}` : "";
      const response = await fetch(
        `/api/v1/availability?machineType=${machineType}&capacity=${capacity}&date=${date}${returnDateQuery}`,
        { signal: AbortSignal.timeout(AVAILABILITY_TIMEOUT_MS) },
      );

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response, "Failed to check availability"),
        );
      }

      const data = await response.json();
      setAvailability(data);
      return data;
    } catch (err) {
      // AbortSignal.timeout rejects with a TimeoutError whose message is not
      // something to show a customer.
      const errorMessage =
        err instanceof DOMException && err.name === "TimeoutError"
          ? "Availability check timed out"
          : err instanceof Error
            ? err.message
            : "An unknown error occurred";
      setError(errorMessage);
      return {
        available: false,
        error: errorMessage,
        machineType,
        capacity,
        date,
      };
    } finally {
      setIsChecking(false);
    }
  };

  return { checkAvailability, isChecking, availability, error };
}

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
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
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

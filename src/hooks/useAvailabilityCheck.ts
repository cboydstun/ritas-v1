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

export function useAvailabilityCheck() {
    const [isChecking, setIsChecking] = useState(false);
    const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const checkAvailability = async (
        machineType: MachineType,
        capacity: 15 | 30 | 45,
        date: string
    ): Promise<AvailabilityResult> => {
        setIsChecking(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/v1/availability?machineType=${machineType}&capacity=${capacity}&date=${date}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to check availability");
            }

            const data = await response.json();
            setAvailability(data);
            return data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
            setError(errorMessage);
            return {
                available: false,
                error: errorMessage,
                machineType,
                capacity,
                date
            };
        } finally {
            setIsChecking(false);
        }
    };

    return { checkAvailability, isChecking, availability, error };
}

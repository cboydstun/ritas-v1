import { MixerType, MachinePackage } from "@/lib/rental-data";
import { MachineType } from "@/types";

export interface MachineConfig extends MachinePackage {
  image: string;
  isPopular?: boolean;
  guestRange: {
    min: number;
    max: number;
  };
}

export interface MachineAvailability {
  machineType: MachineType;
  capacity: 15 | 30 | 45;
  date: string;
  available: boolean;
  stockCount?: number;
  isLimited?: boolean;
}

export interface MachineRecommendation {
  machineType: MachineType;
  reason: string;
  confidence: "high" | "medium" | "low";
  suggestedMixers?: MixerType[];
}

export interface MachineCardProps {
  machineType: MachineType;
  name: string;
  capacity: 15 | 30 | 45;
  basePrice: number;
  isSelected: boolean;
  isAvailable?: boolean;
  isPopular?: boolean;
  onSelect: (machineType: MachineType) => void;
  image: string;
  guestRange?: { min: number; max: number };
}

export interface MixerCardProps {
  mixerType: MixerType | null;
  name: string;
  price: number;
  description: string;
  isSelected: boolean;
  tankIndex: number;
  onChange: (mixerType: MixerType | null, tankIndex: number) => void;
  image?: string;
}

// Type guards
export function isMachineType(value: string): value is MachineType {
  return ["single", "double", "triple"].includes(value);
}

export function isMixerType(value: string): value is MixerType {
  return [
    "non-alcoholic",
    "margarita",
    "pina-colada",
    "strawberry-daiquiri",
  ].includes(value);
}

// Machine recommendation algorithm
export function getRecommendation(
  guestCount: number,
  rentalDate: string,
): MachineRecommendation | null {
  if (!guestCount || guestCount <= 0) return null;

  const rentalDateObj = new Date(rentalDate);
  const month = rentalDateObj.getMonth();
  const dayOfWeek = rentalDateObj.getDay();

  // Determine season from date
  const isSummer = month >= 5 && month <= 8;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Adjust capacity estimate for seasonal factors
  const summerMultiplier = isSummer ? 1.25 : 1;
  const weekendMultiplier = isWeekend ? 1.1 : 1;
  const adjustedCount = Math.ceil(
    guestCount * summerMultiplier * weekendMultiplier,
  );

  if (adjustedCount <= 30) {
    return {
      machineType: "single",
      reason: `Perfect for ${guestCount} guests`,
      confidence: "high",
      suggestedMixers: ["margarita"],
    };
  } else if (adjustedCount <= 60) {
    return {
      machineType: "double",
      reason: `Ideal for ${guestCount} guests with multiple flavors`,
      confidence: "high",
      suggestedMixers: ["margarita", "pina-colada"],
    };
  } else {
    return {
      machineType: "triple",
      reason: `The ultimate setup for ${guestCount} guests`,
      confidence: "high",
      suggestedMixers: ["margarita", "pina-colada", "strawberry-daiquiri"],
    };
  }
}

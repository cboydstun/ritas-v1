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

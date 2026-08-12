import { describe, it, expect } from "@jest/globals";
import {
  isMachineType,
  isMixerType,
  MachineConfig,
  MachineAvailability,
  MachineCardProps,
  MixerCardProps,
} from "@/types/machine";
import { MixerType } from "@/lib/rental-data";
import { MachineType } from "@/types";

describe("Machine Type Definitions", () => {
  describe("MachineConfig interface", () => {
    it("accepts a valid MachineConfig object", () => {
      const config: MachineConfig = {
        type: "single",
        capacity: 15,
        name: "15L Single Tank Machine",
        description: "Perfect for smaller gatherings",
        basePrice: 124.95,
        maxMixers: 1,
        features: ["15L Capacity"],
        image: "/vevor-15l-slushy.jpg",
        isPopular: false,
        guestRange: { min: 10, max: 30 },
      };
      expect(config.type).toBe("single");
      expect(config.image).toBe("/vevor-15l-slushy.jpg");
      expect(config.guestRange.min).toBe(10);
      expect(config.guestRange.max).toBe(30);
    });

    it("allows optional isPopular field", () => {
      const config: MachineConfig = {
        type: "double",
        capacity: 30,
        name: "30L Double Tank Machine",
        description: "Ideal for larger events",
        basePrice: 149.95,
        maxMixers: 2,
        features: ["30L Capacity"],
        image: "/vevor-30l-slushy.png",
        guestRange: { min: 20, max: 60 },
        // isPopular is optional - not provided
      };
      expect(config.isPopular).toBeUndefined();
    });
  });

  describe("MachineAvailability interface", () => {
    it("accepts a valid MachineAvailability object", () => {
      const availability: MachineAvailability = {
        machineType: "single",
        capacity: 15,
        date: "2024-01-15",
        available: true,
        stockCount: 3,
        isLimited: false,
      };
      expect(availability.machineType).toBe("single");
      expect(availability.available).toBe(true);
      expect(availability.stockCount).toBe(3);
    });

    it("allows optional stockCount and isLimited fields", () => {
      const availability: MachineAvailability = {
        machineType: "double",
        capacity: 30,
        date: "2024-01-15",
        available: false,
      };
      expect(availability.stockCount).toBeUndefined();
      expect(availability.isLimited).toBeUndefined();
    });
  });

  describe("MachineCardProps interface", () => {
    it("accepts a valid MachineCardProps object", () => {
      const onSelect = (machineType: MachineType) => machineType;
      const props: MachineCardProps = {
        machineType: "single",
        name: "15L Single Tank Machine",
        capacity: 15,
        basePrice: 124.95,
        isSelected: true,
        isAvailable: true,
        isPopular: false,
        onSelect,
        image: "/vevor-15l-slushy.jpg",
        guestRange: { min: 10, max: 30 },
      };
      expect(props.machineType).toBe("single");
      expect(props.isSelected).toBe(true);
    });
  });

  describe("MixerCardProps interface", () => {
    it("accepts a valid MixerCardProps object", () => {
      const onChange = (mixerType: MixerType | null, tankIndex: number) => ({
        mixerType,
        tankIndex,
      });
      const props: MixerCardProps = {
        mixerType: "margarita",
        name: "Margarita Mixer",
        price: 19.95,
        description: "Classic margarita mix",
        isSelected: true,
        tankIndex: 0,
        onChange,
      };
      expect(props.mixerType).toBe("margarita");
      expect(props.tankIndex).toBe(0);
    });

    it("accepts null mixerType for No Mixer option", () => {
      const onChange = (mixerType: MixerType | null, tankIndex: number) => ({
        mixerType,
        tankIndex,
      });
      const props: MixerCardProps = {
        mixerType: null,
        name: "No Mixer",
        price: 0,
        description: "Bring your own mixer",
        isSelected: false,
        tankIndex: 0,
        onChange,
      };
      expect(props.mixerType).toBeNull();
    });
  });

  describe("isMachineType type guard", () => {
    it("returns true for 'single'", () => {
      expect(isMachineType("single")).toBe(true);
    });

    it("returns true for 'double'", () => {
      expect(isMachineType("double")).toBe(true);
    });

    it("returns true for 'triple'", () => {
      expect(isMachineType("triple")).toBe(true);
    });

    it("returns false for invalid value 'quad'", () => {
      expect(isMachineType("quad")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isMachineType("")).toBe(false);
    });

    it("returns false for partial match 'sing'", () => {
      expect(isMachineType("sing")).toBe(false);
    });

    it("returns false for uppercase 'Single'", () => {
      expect(isMachineType("Single")).toBe(false);
    });
  });

  describe("isMixerType type guard", () => {
    it("returns true for 'non-alcoholic'", () => {
      expect(isMixerType("non-alcoholic")).toBe(true);
    });

    it("returns true for 'margarita'", () => {
      expect(isMixerType("margarita")).toBe(true);
    });

    it("returns true for 'pina-colada'", () => {
      expect(isMixerType("pina-colada")).toBe(true);
    });

    it("returns true for 'strawberry-daiquiri'", () => {
      expect(isMixerType("strawberry-daiquiri")).toBe(true);
    });

    it("returns false for invalid value 'mojito'", () => {
      expect(isMixerType("mojito")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isMixerType("")).toBe(false);
    });

    it("returns false for uppercase 'Margarita'", () => {
      expect(isMixerType("Margarita")).toBe(false);
    });
  });
});

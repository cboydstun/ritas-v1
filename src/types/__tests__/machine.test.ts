import { describe, it, expect } from "@jest/globals";
import {
  isMachineType,
  isMixerType,
  getRecommendation,
  MachineConfig,
  MachineAvailability,
  MachineRecommendation,
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

  describe("MachineRecommendation interface", () => {
    it("accepts a valid MachineRecommendation object", () => {
      const recommendation: MachineRecommendation = {
        machineType: "triple",
        reason: "Perfect for 80 guests",
        confidence: "high",
        suggestedMixers: ["margarita", "pina-colada", "strawberry-daiquiri"],
      };
      expect(recommendation.machineType).toBe("triple");
      expect(recommendation.confidence).toBe("high");
      expect(recommendation.suggestedMixers).toHaveLength(3);
    });

    it("accepts all confidence levels", () => {
      const high: MachineRecommendation = {
        machineType: "single",
        reason: "test",
        confidence: "high",
      };
      const medium: MachineRecommendation = {
        machineType: "single",
        reason: "test",
        confidence: "medium",
      };
      const low: MachineRecommendation = {
        machineType: "single",
        reason: "test",
        confidence: "low",
      };
      expect(high.confidence).toBe("high");
      expect(medium.confidence).toBe("medium");
      expect(low.confidence).toBe("low");
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
      const onChange = (mixerType: MixerType | null, tankIndex: number) =>
        ({ mixerType, tankIndex });
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
      const onChange = (mixerType: MixerType | null, tankIndex: number) =>
        ({ mixerType, tankIndex });
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

  describe("getRecommendation algorithm", () => {
    // Using a winter weekday date to avoid multipliers: 2024-01-15 (Monday)
    const winterWeekday = "2024-01-15";
    // Using a summer weekday date: 2024-07-15 (Monday)
    const summerWeekday = "2024-07-15";
    // Using a winter weekend: 2024-01-20 (Saturday)
    const winterWeekend = "2024-01-20";

    describe("Guest count thresholds (winter weekday, no multipliers)", () => {
      it("suggests single tank for 1 guest", () => {
        const result = getRecommendation(1, winterWeekday);
        expect(result?.machineType).toBe("single");
      });

      it("suggests single tank for 20 guests", () => {
        const result = getRecommendation(20, winterWeekday);
        expect(result?.machineType).toBe("single");
      });

      it("suggests single tank for 30 guests", () => {
        const result = getRecommendation(30, winterWeekday);
        expect(result?.machineType).toBe("single");
      });

      it("suggests double tank for 31 guests", () => {
        const result = getRecommendation(31, winterWeekday);
        expect(result?.machineType).toBe("double");
      });

      it("suggests double tank for 45 guests", () => {
        const result = getRecommendation(45, winterWeekday);
        expect(result?.machineType).toBe("double");
      });

      it("suggests double tank for 60 guests", () => {
        const result = getRecommendation(60, winterWeekday);
        expect(result?.machineType).toBe("double");
      });

      it("suggests triple tank for 61 guests", () => {
        const result = getRecommendation(61, winterWeekday);
        expect(result?.machineType).toBe("triple");
      });

      it("suggests triple tank for 100 guests", () => {
        const result = getRecommendation(100, winterWeekday);
        expect(result?.machineType).toBe("triple");
      });
    });

    describe("Summer adjustment", () => {
      it("suggests higher capacity in summer for borderline count (24 guests)", () => {
        // 24 guests in winter -> single (24 <= 30)
        const winterResult = getRecommendation(24, winterWeekday);
        expect(winterResult?.machineType).toBe("single");

        // 24 guests in summer -> 24 * 1.25 = 30 -> single (30 <= 30)
        const summerResult = getRecommendation(24, summerWeekday);
        expect(summerResult?.machineType).toBe("single");
      });

      it("suggests double tank in summer for 25 guests", () => {
        // 25 * 1.25 = 31.25, ceil = 32 -> double (32 > 30)
        const result = getRecommendation(25, summerWeekday);
        expect(result?.machineType).toBe("double");
      });

      it("adjusts up for summer: 49 guests suggests triple", () => {
        // 49 * 1.25 = 61.25, ceil = 62 -> triple (62 > 60)
        const result = getRecommendation(49, summerWeekday);
        expect(result?.machineType).toBe("triple");
      });
    });

    describe("Weekend adjustment", () => {
      it("adjusts up for weekend: 28 guests on winter weekend", () => {
        // 28 * 1.1 = 30.8, ceil = 31 -> double (31 > 30)
        const result = getRecommendation(28, winterWeekend);
        expect(result?.machineType).toBe("double");
      });
    });

    describe("Edge cases", () => {
      it("returns null for 0 guests", () => {
        expect(getRecommendation(0, winterWeekday)).toBeNull();
      });

      it("returns null for negative guest count", () => {
        expect(getRecommendation(-5, winterWeekday)).toBeNull();
      });
    });

    describe("Recommendation properties", () => {
      it("includes a reason message for single tank", () => {
        const result = getRecommendation(20, winterWeekday);
        expect(result?.reason).toBeTruthy();
        expect(typeof result?.reason).toBe("string");
        expect(result?.reason).toContain("20");
      });

      it("includes a reason message for double tank", () => {
        const result = getRecommendation(40, winterWeekday);
        expect(result?.reason).toBeTruthy();
        expect(result?.reason).toContain("40");
      });

      it("includes a reason message for triple tank", () => {
        const result = getRecommendation(70, winterWeekday);
        expect(result?.reason).toBeTruthy();
        expect(result?.reason).toContain("70");
      });

      it("has confidence level 'high'", () => {
        const result = getRecommendation(20, winterWeekday);
        expect(result?.confidence).toBe("high");
      });

      it("suggests margarita as a mixer for single tank", () => {
        const result = getRecommendation(20, winterWeekday);
        expect(result?.suggestedMixers).toContain("margarita");
      });

      it("suggests margarita and pina-colada for double tank", () => {
        const result = getRecommendation(40, winterWeekday);
        expect(result?.suggestedMixers).toContain("margarita");
        expect(result?.suggestedMixers).toContain("pina-colada");
      });

      it("suggests 3 mixers for triple tank", () => {
        const result = getRecommendation(70, winterWeekday);
        expect(result?.suggestedMixers).toHaveLength(3);
      });
    });
  });
});

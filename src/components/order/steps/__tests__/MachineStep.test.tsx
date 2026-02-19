import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import MachineStep from "../MachineStep";
import { MixerType } from "@/lib/rental-data";
import { OrderFormData } from "@/components/order/types";

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    fill: _fill,
    priority: _priority,
    className,
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    priority?: boolean;
    className?: string;
  }) => <img src={src} alt={alt} className={className} />,
}));

const createMockFormData = (
  overrides: Partial<OrderFormData> = {},
): OrderFormData => ({
  machineType: "single",
  capacity: 15,
  selectedMixers: [],
  selectedExtras: [],
  price: 124.95,
  rentalDate: "",
  rentalTime: "12:00",
  returnDate: "",
  returnTime: "12:00",
  customer: {
    name: "",
    email: "",
    phone: "",
    address: { street: "", city: "", state: "", zipCode: "" },
  },
  notes: "",
  ...overrides,
});

describe("MachineStep", () => {
  let mockOnInputChange: jest.Mock;

  beforeEach(() => {
    mockOnInputChange = jest.fn();
  });

  // =========================================================================
  // Component Initialization
  // =========================================================================
  describe("Component Initialization", () => {
    it("renders with heading 'Select Your Machine'", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText("Select Your Machine")).toBeInTheDocument();
    });

    it("renders the subtitle text", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(
        screen.getByText("Choose your perfect frozen drink machine setup"),
      ).toBeInTheDocument();
    });

    it("renders 'Machine Type' section label", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText("Machine Type")).toBeInTheDocument();
    });

    it("shows 3 substep progress dots", () => {
      const { container } = render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      const dots = container.querySelectorAll(".w-3.h-3.rounded-full");
      expect(dots.length).toBe(3);
    });

    it("has first progress dot active on initial render", () => {
      const { container } = render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      const dots = container.querySelectorAll(".w-3.h-3.rounded-full");
      expect(dots[0]).toHaveClass("bg-margarita");
      expect(dots[1]).not.toHaveClass("bg-margarita");
      expect(dots[2]).not.toHaveClass("bg-margarita");
    });
  });

  // =========================================================================
  // Machine Card Grid
  // =========================================================================
  describe("Machine Card Grid", () => {
    it("renders 3 machine cards", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(
        screen.getByRole("button", { name: /Select 15L Single Tank Machine/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Select 30L Double Tank Machine/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Select 45L Triple Tank Machine/i }),
      ).toBeInTheDocument();
    });

    it("displays machine names in cards", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText("15L Single Tank Machine")).toBeInTheDocument();
      expect(screen.getByText("30L Double Tank Machine")).toBeInTheDocument();
      expect(screen.getByText("45L Triple Tank Machine")).toBeInTheDocument();
    });

    it("displays prices in machine cards", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText("$124.95")).toBeInTheDocument();
      expect(screen.getByText("$149.95")).toBeInTheDocument();
      expect(screen.getByText("$175.95")).toBeInTheDocument();
    });

    it("shows guest ranges in machine cards", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText(/10.*30 guests/i)).toBeInTheDocument();
      expect(screen.getByText(/20.*60 guests/i)).toBeInTheDocument();
      expect(screen.getByText(/40.*90 guests/i)).toBeInTheDocument();
    });

    it("shows 'POPULAR' badge on the double tank card", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText("POPULAR")).toBeInTheDocument();
    });

    it("shows single tank as selected when machineType is 'single'", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      const singleCard = screen.getByRole("button", {
        name: /Select 15L Single Tank Machine/i,
      });
      expect(singleCard).toHaveAttribute("aria-pressed", "true");
    });

    it("shows double tank as selected when machineType is 'double'", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "double", capacity: 30 })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      const doubleCard = screen.getByRole("button", {
        name: /Select 30L Double Tank Machine/i,
      });
      expect(doubleCard).toHaveAttribute("aria-pressed", "true");
    });

    it("shows triple tank as selected when machineType is 'triple'", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "triple", capacity: 45 })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      const tripleCard = screen.getByRole("button", {
        name: /Select 45L Triple Tank Machine/i,
      });
      expect(tripleCard).toHaveAttribute("aria-pressed", "true");
    });

    it("calls onInputChange when a machine card is clicked", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      const doubleCard = screen.getByRole("button", {
        name: /Select 30L Double Tank Machine/i,
      });
      fireEvent.click(doubleCard);
      expect(mockOnInputChange).toHaveBeenCalled();
    });

    it("shows machine images", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(
        screen.getByAltText("15L Single Tank Machine"),
      ).toBeInTheDocument();
      expect(
        screen.getByAltText("30L Double Tank Machine"),
      ).toBeInTheDocument();
      expect(
        screen.getByAltText("45L Triple Tank Machine"),
      ).toBeInTheDocument();
    });

    it("machine images have correct src", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(
        screen.getByAltText("15L Single Tank Machine").getAttribute("src"),
      ).toContain("vevor-15l-slushy");
      expect(
        screen.getByAltText("30L Double Tank Machine").getAttribute("src"),
      ).toContain("vevor-30l-slushy");
      expect(
        screen.getByAltText("45L Triple Tank Machine").getAttribute("src"),
      ).toContain("vevor-45l-slushy-2");
    });
  });

  // =========================================================================
  // Mixer Selection - Single Tank
  // =========================================================================
  describe("Mixer Selection - Single Tank", () => {
    it("shows 'Select 1 Mixer' label for single tank", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText("Select 1 Mixer")).toBeInTheDocument();
    });

    it("shows all 4 mixer type options for single tank", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText(/Margarita Mixer/i)).toBeInTheDocument();
      expect(screen.getByText(/Piña Colada Mixer/i)).toBeInTheDocument();
      expect(screen.getByText(/Strawberry Daiquiri Mixer/i)).toBeInTheDocument();
      expect(screen.getByText(/Kool Aid/i)).toBeInTheDocument();
    });

    it("shows 'No Mixer' option for single tank", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByLabelText("No Mixer")).toBeInTheDocument();
    });

    it("shows 5 mixer checkboxes for single tank (4 types + No Mixer)", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBe(5);
    });

    it("shows margarita as checked when in selectedMixers", () => {
      render(
        <MachineStep
          formData={createMockFormData({
            machineType: "single",
            selectedMixers: ["margarita" as MixerType],
          })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      const checkbox = screen.getByLabelText(/Margarita Mixer/i);
      expect(checkbox).toBeChecked();
    });

    it("shows 'No Mixer' as checked when selectedMixers is empty", () => {
      render(
        <MachineStep
          formData={createMockFormData({
            machineType: "single",
            selectedMixers: [],
          })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByLabelText("No Mixer")).toBeChecked();
    });

    it("shows 'No Mixer' as unchecked when a mixer is selected", () => {
      render(
        <MachineStep
          formData={createMockFormData({
            machineType: "single",
            selectedMixers: ["margarita" as MixerType],
          })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByLabelText("No Mixer")).not.toBeChecked();
    });

    it("calls onInputChange when a mixer is clicked", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      fireEvent.click(screen.getByLabelText(/Margarita Mixer/i));
      expect(mockOnInputChange).toHaveBeenCalled();
    });

    it("calls onInputChange with margarita when margarita is selected", () => {
      render(
        <MachineStep
          formData={createMockFormData({
            machineType: "single",
            selectedMixers: [],
          })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      fireEvent.click(screen.getByLabelText(/Margarita Mixer/i));
      const call = mockOnInputChange.mock.calls.find(
        (c) =>
          (c[0] as { target: { name: string } }).target.name ===
          "selectedMixers",
      );
      expect(call).toBeDefined();
      const value = (call![0] as { target: { value: string[] } }).target.value;
      expect(value).toContain("margarita");
    });

    it("calls onInputChange with empty array when No Mixer is clicked", () => {
      render(
        <MachineStep
          formData={createMockFormData({
            machineType: "single",
            selectedMixers: ["margarita" as MixerType],
          })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      fireEvent.click(screen.getByLabelText("No Mixer"));
      const call = mockOnInputChange.mock.calls.find(
        (c) =>
          (c[0] as { target: { name: string } }).target.name ===
          "selectedMixers",
      );
      expect(call).toBeDefined();
      const value = (call![0] as { target: { value: string[] } }).target.value;
      expect(value).toEqual([]);
    });

    it("shows mixer prices", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getAllByText(/\+\$19\.95/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/\+\$24\.95/).length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Mixer Selection - Double Tank
  // =========================================================================
  describe("Mixer Selection - Double Tank", () => {
    it("shows 'Select 2 Mixers' for double tank", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "double", capacity: 30 })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText("Select 2 Mixers")).toBeInTheDocument();
    });

    it("shows Tank 1 and Tank 2 sections", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "double", capacity: 30 })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText("Tank 1:")).toBeInTheDocument();
      expect(screen.getByText("Tank 2:")).toBeInTheDocument();
    });

    it("does not show Tank 3 for double tank", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "double", capacity: 30 })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.queryByText("Tank 3:")).not.toBeInTheDocument();
    });

    it("shows 2 'No Mixer' checkboxes for double tank", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "double", capacity: 30 })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getAllByLabelText("No Mixer")).toHaveLength(2);
    });

    it("shows tank 1 mixer as checked when selectedMixers[0] is set", () => {
      render(
        <MachineStep
          formData={createMockFormData({
            machineType: "double",
            capacity: 30,
            selectedMixers: [
              "margarita" as MixerType,
              "pina-colada" as MixerType,
            ],
          })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(document.getElementById("tank1-margarita")).toBeChecked();
    });

    it("shows tank 2 mixer as checked when selectedMixers[1] is set", () => {
      render(
        <MachineStep
          formData={createMockFormData({
            machineType: "double",
            capacity: 30,
            selectedMixers: [
              "margarita" as MixerType,
              "pina-colada" as MixerType,
            ],
          })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(document.getElementById("tank2-pina-colada")).toBeChecked();
    });
  });

  // =========================================================================
  // Mixer Selection - Triple Tank
  // =========================================================================
  describe("Mixer Selection - Triple Tank", () => {
    it("shows 'Select 3 Mixers' for triple tank", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "triple", capacity: 45 })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText("Select 3 Mixers")).toBeInTheDocument();
    });

    it("shows Tank 1, Tank 2, Tank 3 sections", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "triple", capacity: 45 })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByText("Tank 1:")).toBeInTheDocument();
      expect(screen.getByText("Tank 2:")).toBeInTheDocument();
      expect(screen.getByText("Tank 3:")).toBeInTheDocument();
    });

    it("shows 3 'No Mixer' checkboxes for triple tank", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "triple", capacity: 45 })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getAllByLabelText("No Mixer")).toHaveLength(3);
    });

    it("shows tank 3 mixer as checked when selectedMixers[2] is set", () => {
      render(
        <MachineStep
          formData={createMockFormData({
            machineType: "triple",
            capacity: 45,
            selectedMixers: [
              "margarita" as MixerType,
              "pina-colada" as MixerType,
              "strawberry-daiquiri" as MixerType,
            ],
          })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(
        document.getElementById("tank3-triple-strawberry-daiquiri"),
      ).toBeChecked();
    });
  });

  // =========================================================================
  // Substep Progress
  // =========================================================================
  describe("Substep Progress", () => {
    it("advances to mixer substep after machine card is selected", () => {
      const { container } = render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: /Select 30L Double Tank Machine/i }),
      );
      const dots = container.querySelectorAll(".w-3.h-3.rounded-full");
      expect(dots[0]).toHaveClass("bg-margarita");
      expect(dots[1]).toHaveClass("bg-margarita");
    });

    it("advances to final substep after mixer is selected", () => {
      const { container } = render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      // First advance to mixer step
      fireEvent.click(
        screen.getByRole("button", { name: /Select 15L Single Tank Machine/i }),
      );
      // Then select a mixer
      fireEvent.click(screen.getByLabelText(/Margarita Mixer/i));

      const dots = container.querySelectorAll(".w-3.h-3.rounded-full");
      expect(dots[2]).toHaveClass("bg-margarita");
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================
  describe("Error Handling", () => {
    it("shows error message when error prop is provided", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error="Please select a machine type"
        />,
      );
      expect(
        screen.getByText("Please select a machine type"),
      ).toBeInTheDocument();
    });

    it("shows error in red container", () => {
      const { container } = render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error="Error occurred"
        />,
      );
      expect(container.querySelector(".bg-red-100")).toBeInTheDocument();
    });

    it("does not show error container when error is null", () => {
      const { container } = render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(container.querySelector(".bg-red-100")).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Date Display
  // =========================================================================
  describe("Date Display", () => {
    it("shows date section when both dates are provided", () => {
      const { container } = render(
        <MachineStep
          formData={createMockFormData({
            rentalDate: "2024-01-15",
            returnDate: "2024-01-16",
          })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(container.querySelector('[class*="bg-margarita"]')).not.toBeNull();
    });

    it("shows calendar emoji when dates are provided", () => {
      render(
        <MachineStep
          formData={createMockFormData({
            rentalDate: "2024-01-15",
            returnDate: "2024-01-16",
          })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      const elements = screen.queryAllByText((content) =>
        content.includes("📅"),
      );
      expect(elements.length).toBeGreaterThan(0);
    });

    it("does not show calendar emoji when dates are empty", () => {
      render(
        <MachineStep
          formData={createMockFormData({ rentalDate: "", returnDate: "" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(
        screen.queryAllByText((content) => content.includes("📅")),
      ).toHaveLength(0);
    });
  });

  // =========================================================================
  // Accessibility
  // =========================================================================
  describe("Accessibility", () => {
    it("machine cards have aria-label", () => {
      render(
        <MachineStep
          formData={createMockFormData()}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(
        screen.getByRole("button", { name: /Select 15L Single Tank Machine/i }),
      ).toHaveAttribute("aria-label");
    });

    it("machine cards have aria-pressed attribute", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      const singleCard = screen.getByRole("button", {
        name: /Select 15L Single Tank Machine/i,
      });
      expect(singleCard).toHaveAttribute("aria-pressed");
    });

    it("mixer checkboxes have associated labels", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      expect(screen.getByLabelText(/Margarita Mixer/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Piña Colada Mixer/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Strawberry Daiquiri Mixer/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("No Mixer")).toBeInTheDocument();
    });

    it("mixer checkboxes are of type checkbox", () => {
      render(
        <MachineStep
          formData={createMockFormData({ machineType: "single" })}
          onInputChange={mockOnInputChange}
          error={null}
        />,
      );
      screen.getAllByRole("checkbox").forEach((cb) => {
        expect(cb).toHaveAttribute("type", "checkbox");
      });
    });
  });
});

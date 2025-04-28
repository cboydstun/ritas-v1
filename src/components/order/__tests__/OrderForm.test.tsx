import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrderForm from "../OrderForm";
import "@testing-library/jest-dom";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock the next/navigation hooks
jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((param: string) => {
      if (param === "machine") return "single";
      if (param === "mixer") return null;
      return null;
    }),
  }),
}));

// Mock the dynamic imports
jest.mock("next/dynamic", () => (fn: any) => {
  const Component = fn().then((mod: any) => mod.default);
  return Component;
});

// Mock the step components
jest.mock("../steps/DeliveryStep", () => ({
  __esModule: true,
  default: ({ formData, onInputChange, error }: any) => (
    <div data-testid="delivery-step">
      <h2>Delivery Step</h2>
      <input
        data-testid="rental-date"
        type="date"
        name="rentalDate"
        value={formData.rentalDate}
        onChange={onInputChange}
      />
      <input
        data-testid="return-date"
        type="date"
        name="returnDate"
        value={formData.returnDate}
        onChange={onInputChange}
      />
      <select
        data-testid="rental-time"
        name="rentalTime"
        value={formData.rentalTime}
        onChange={onInputChange}
      >
        <option value="12:00">12:00 PM</option>
      </select>
      <select
        data-testid="return-time"
        name="returnTime"
        value={formData.returnTime}
        onChange={onInputChange}
      >
        <option value="12:00">12:00 PM</option>
      </select>
      {error && <div data-testid="error-message">{error}</div>}
    </div>
  ),
}));

jest.mock("../steps/DetailsStep", () => ({
  __esModule: true,
  default: ({ formData, onInputChange, error }: any) => (
    <div data-testid="details-step">
      <h2>Details Step</h2>
      <input
        data-testid="customer-name"
        type="text"
        name="customer.name"
        value={formData.customer.name}
        onChange={onInputChange}
      />
      <input
        data-testid="customer-email"
        type="email"
        name="customer.email"
        value={formData.customer.email}
        onChange={onInputChange}
      />
      <input
        data-testid="customer-phone"
        type="tel"
        name="customer.phone"
        value={formData.customer.phone}
        onChange={onInputChange}
      />
      <input
        data-testid="customer-street"
        type="text"
        name="customer.address.street"
        value={formData.customer.address.street}
        onChange={onInputChange}
      />
      <input
        data-testid="customer-city"
        type="text"
        name="customer.address.city"
        value={formData.customer.address.city}
        onChange={onInputChange}
      />
      <input
        data-testid="customer-state"
        type="text"
        name="customer.address.state"
        value={formData.customer.address.state}
        onChange={onInputChange}
      />
      <input
        data-testid="customer-zipcode"
        type="text"
        name="customer.address.zipCode"
        value={formData.customer.address.zipCode}
        onChange={onInputChange}
      />
      {error && <div data-testid="error-message">{error}</div>}
    </div>
  ),
}));

jest.mock("../steps/ExtrasStep", () => ({
  __esModule: true,
  default: () => <div data-testid="extras-step">Extras Step</div>,
}));

jest.mock("../steps/ReviewStep", () => ({
  __esModule: true,
  default: () => <div data-testid="review-step">Review Step</div>,
}));

jest.mock("../steps/PaymentStep", () => ({
  __esModule: true,
  default: () => <div data-testid="payment-step">Payment Step</div>,
}));

// Mock the OrderFormTracker component
jest.mock("../OrderFormTracker", () => ({
  __esModule: true,
  default: () => <div data-testid="order-form-tracker">Order Form Tracker</div>,
}));

// Mock the ProgressBar component
jest.mock("../ProgressBar", () => ({
  __esModule: true,
  ProgressBar: () => <div data-testid="progress-bar">Progress Bar</div>,
}));

// Mock the NavigationButtons component
jest.mock("../NavigationButtons", () => ({
  __esModule: true,
  NavigationButtons: ({ onNext, onPrevious }: any) => (
    <div data-testid="navigation-buttons">
      <button data-testid="prev-button" onClick={onPrevious}>
        Previous
      </button>
      <button data-testid="next-button" onClick={onNext}>
        Next Step
      </button>
    </div>
  ),
}));

describe("OrderForm", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  it("should render the delivery step initially", () => {
    render(<OrderForm />);
    expect(screen.getByTestId("delivery-step")).toBeInTheDocument();
  });

  it("should validate delivery date and time before proceeding", async () => {
    render(<OrderForm />);
    
    // Try to proceed without filling in required fields
    fireEvent.click(screen.getByTestId("next-button"));
    
    // Should show error
    expect(screen.getByTestId("error-message")).toHaveTextContent("Please select a delivery date");
  });

  it("should validate ZIP code and show error for non-Bexar County ZIP code", async () => {
    render(<OrderForm />);
    
    // Fill in delivery step fields
    fireEvent.change(screen.getByTestId("rental-date"), { target: { value: "2025-05-01" } });
    fireEvent.change(screen.getByTestId("rental-time"), { target: { value: "12:00" } });
    fireEvent.change(screen.getByTestId("return-date"), { target: { value: "2025-05-02" } });
    fireEvent.change(screen.getByTestId("return-time"), { target: { value: "12:00" } });
    
    // Proceed to details step
    fireEvent.click(screen.getByTestId("next-button"));
    
    // Fill in details step fields with invalid ZIP code
    fireEvent.change(screen.getByTestId("customer-name"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByTestId("customer-email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByTestId("customer-phone"), { target: { value: "123-456-7890" } });
    fireEvent.change(screen.getByTestId("customer-street"), { target: { value: "123 Test St" } });
    fireEvent.change(screen.getByTestId("customer-city"), { target: { value: "Test City" } });
    fireEvent.change(screen.getByTestId("customer-state"), { target: { value: "TX" } });
    fireEvent.change(screen.getByTestId("customer-zipcode"), { target: { value: "12345" } }); // Non-Bexar County ZIP
    
    // Try to proceed
    fireEvent.click(screen.getByTestId("next-button"));
    
    // Should show error about Bexar County
    expect(screen.getByTestId("error-message")).toHaveTextContent("We only deliver within Bexar County");
  });

  it("should bypass ZIP code validation after clicking Next Step button 5 times", async () => {
    render(<OrderForm />);
    
    // Fill in delivery step fields
    fireEvent.change(screen.getByTestId("rental-date"), { target: { value: "2025-05-01" } });
    fireEvent.change(screen.getByTestId("rental-time"), { target: { value: "12:00" } });
    fireEvent.change(screen.getByTestId("return-date"), { target: { value: "2025-05-02" } });
    fireEvent.change(screen.getByTestId("return-time"), { target: { value: "12:00" } });
    
    // Proceed to details step
    fireEvent.click(screen.getByTestId("next-button"));
    
    // Fill in details step fields with invalid ZIP code
    fireEvent.change(screen.getByTestId("customer-name"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByTestId("customer-email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByTestId("customer-phone"), { target: { value: "123-456-7890" } });
    fireEvent.change(screen.getByTestId("customer-street"), { target: { value: "123 Test St" } });
    fireEvent.change(screen.getByTestId("customer-city"), { target: { value: "Test City" } });
    fireEvent.change(screen.getByTestId("customer-state"), { target: { value: "TX" } });
    fireEvent.change(screen.getByTestId("customer-zipcode"), { target: { value: "12345" } }); // Non-Bexar County ZIP
    
    // Click Next Step button 5 times
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId("next-button"));
    }
    
    // On the 6th click, it should bypass the validation and proceed to extras step
    fireEvent.click(screen.getByTestId("next-button"));
    
    // Should now be on extras step
    await waitFor(() => {
      expect(screen.getByTestId("extras-step")).toBeInTheDocument();
    });
  });
});

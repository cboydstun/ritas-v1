/**
 * @jest-environment node
 */
import { POST } from "../route";
import { NextResponse } from "next/server";
import { LeaseInquiry } from "@/models/leaseInquiry";
import { Resend } from "resend";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/leaseInquiry", () => ({
  LeaseInquiry: {
    create: jest.fn(),
  },
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: {}, error: null }),
    },
  })),
}));

const mockResend = Resend as jest.MockedClass<typeof Resend>;

const validRequestBody = {
  businessName: "Casa Test Cantina",
  businessType: "Restaurant",
  contactName: "Jane Operator",
  email: "owner@casatest.com",
  phone: "(210) 555-0199",
  address: {
    street: "123 Main St",
    city: "San Antonio",
    state: "TX",
    zip: "78205",
  },
  preferredTerm: "12-month",
  machinesOfInterest: ["double-30"],
  message: "Looking to add frozen drinks to our lunch menu.",
};

describe("POST /api/v1/lease-inquiries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResend.mockImplementation(
      () =>
        ({
          emails: {
            send: jest.fn().mockResolvedValue({ data: {}, error: null }),
          },
        }) as unknown as Resend,
    );
  });

  it("should create a lease inquiry and send email notification", async () => {
    (LeaseInquiry.create as jest.Mock).mockResolvedValue({
      _id: "mock-id",
      ...validRequestBody,
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new Request(
      "http://localhost:3000/api/v1/lease-inquiries",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequestBody),
      },
    );

    const response = await POST(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(201);

    const responseData = await response.json();
    expect(responseData.message).toBe("Lease inquiry submitted successfully");
    expect(LeaseInquiry.create).toHaveBeenCalledWith(validRequestBody);

    expect(mockResend).toHaveBeenCalled();
    const resendInstance = mockResend.mock.results[0].value;
    expect(resendInstance.emails.send).toHaveBeenCalled();
    const emailCall = (resendInstance.emails.send as jest.Mock).mock
      .calls[0][0];
    expect(emailCall.subject).toContain("New Long-Term Lease Inquiry");
    expect(emailCall.html).toContain(validRequestBody.businessName);
    expect(emailCall.html).toContain(validRequestBody.email);
  });

  it("should continue with request if email sending fails", async () => {
    (LeaseInquiry.create as jest.Mock).mockResolvedValue({
      _id: "mock-id",
      ...validRequestBody,
      status: "new",
    });

    mockResend.mockImplementation(
      () =>
        ({
          emails: {
            send: jest
              .fn()
              .mockRejectedValue(new Error("Email sending failed")),
          },
        }) as unknown as Resend,
    );

    const request = new Request(
      "http://localhost:3000/api/v1/lease-inquiries",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequestBody),
      },
    );

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    const response = await POST(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(201);

    const responseData = await response.json();
    expect(responseData.message).toBe("Lease inquiry submitted successfully");
    expect(LeaseInquiry.create).toHaveBeenCalledWith(validRequestBody);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain(
      "Error sending lease inquiry notification email",
    );

    consoleErrorSpy.mockRestore();
  });

  it("should return 400 for invalid data", async () => {
    const validationError = new Error(
      "LeaseInquiry validation failed: businessName: Path `businessName` is required.",
    );
    validationError.name = "ValidationError";
    (LeaseInquiry.create as jest.Mock).mockRejectedValue(validationError);

    const request = new Request(
      "http://localhost:3000/api/v1/lease-inquiries",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName: "Jane Operator" }),
      },
    );

    const response = await POST(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(400);

    const responseData = await response.json();
    expect(responseData.message).toBe("Invalid lease inquiry data");
  });
});

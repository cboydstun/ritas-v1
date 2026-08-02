/**
 * @jest-environment node
 */
import { POST } from "../route";
import { NextResponse } from "next/server";
import { Contact } from "@/models/contact";
import { Resend } from "resend";

// Mock the MongoDB connection
jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

// Mock the Contact model
jest.mock("@/models/contact", () => ({
  Contact: {
    create: jest.fn(),
  },
}));

// Mock Resend email client
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: {}, error: null }),
    },
  })),
}));

const mockResend = Resend as jest.MockedClass<typeof Resend>;

describe("POST /api/v1/contacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-initialize the Resend mock implementation after clearAllMocks
    mockResend.mockImplementation(
      () =>
        ({
          emails: {
            send: jest.fn().mockResolvedValue({ data: {}, error: null }),
          },
        }) as unknown as Resend,
    );
  });

  it("should create a new contact and send email notification", async () => {
    const requestData = {
      name: "Test User",
      email: "test@example.com",
      phone: "(210) 555-1234",
      eventDate: "2025-05-15",
      message: "This is a test message",
    };

    (Contact.create as jest.Mock).mockResolvedValue({
      _id: "mock-id",
      ...requestData,
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new Request("http://localhost:3000/api/v1/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });

    const response = await POST(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(201);

    const responseData = await response.json();
    expect(responseData.message).toBe("Contact form submitted successfully");
    expect(Contact.create).toHaveBeenCalledWith(requestData);

    // Verify Resend was instantiated and emails.send was called
    expect(mockResend).toHaveBeenCalled();
    const resendInstance = mockResend.mock.results[0].value;
    expect(resendInstance.emails.send).toHaveBeenCalled();
    const emailCall = (resendInstance.emails.send as jest.Mock).mock
      .calls[0][0];
    expect(emailCall.subject).toContain("New Contact Form Submission");
    expect(emailCall.html).toContain(requestData.name);
    expect(emailCall.html).toContain(requestData.email);
  });

  it("should continue with request if email sending fails", async () => {
    const requestData = {
      name: "Test User",
      email: "test@example.com",
      phone: "(210) 555-1234",
      eventDate: "2025-05-15",
      message: "This is a test message",
    };

    (Contact.create as jest.Mock).mockResolvedValue({
      _id: "mock-id",
      ...requestData,
      status: "new",
    });

    // Make Resend.emails.send throw
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

    const request = new Request("http://localhost:3000/api/v1/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    const response = await POST(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(201);

    const responseData = await response.json();
    expect(responseData.message).toBe("Contact form submitted successfully");
    expect(Contact.create).toHaveBeenCalledWith(requestData);

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain(
      "Error sending contact notification email",
    );

    consoleErrorSpy.mockRestore();
  });

  it("should return 400 for invalid data without touching the database", async () => {
    // Incomplete bodies are now rejected by the schema before Mongo is
    // involved, rather than surfacing as a Mongoose ValidationError.
    const requestData = { name: "Test User" };

    const request = new Request("http://localhost:3000/api/v1/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });

    const response = await POST(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(400);
    expect(Contact.create).not.toHaveBeenCalled();

    const responseData = await response.json();
    expect(responseData.message).toMatch(/email/);
  });

  it("should not let the caller set status or timestamps", async () => {
    const request = new Request("http://localhost:3000/api/v1/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "test@example.com",
        phone: "2105551234",
        eventDate: "2030-06-01",
        message: "Hello",
        status: "completed",
        createdAt: "1999-01-01",
        _id: "deadbeefdeadbeefdeadbeef",
      }),
    });

    await POST(request);

    const created = (Contact.create as jest.Mock).mock.calls[0][0];
    expect(created).not.toHaveProperty("status");
    expect(created).not.toHaveProperty("createdAt");
    expect(created).not.toHaveProperty("_id");
  });
});

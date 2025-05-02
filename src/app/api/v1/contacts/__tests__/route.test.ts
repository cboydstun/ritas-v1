import { POST } from "../route";
import { NextResponse } from "next/server";
import { Contact } from "@/models/contact";
import nodemailer from "nodemailer";

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

// Mock nodemailer
jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true),
  }),
}));

describe("POST /api/v1/contacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a new contact and send email notification", async () => {
    // Mock request data
    const requestData = {
      name: "Test User",
      email: "test@example.com",
      phone: "(210) 555-1234",
      eventDate: "2025-05-15",
      message: "This is a test message",
    };

    // Mock the Contact.create method
    (Contact.create as jest.Mock).mockResolvedValue({
      _id: "mock-id",
      ...requestData,
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create a mock request
    const request = new Request("http://localhost:3000/api/v1/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    // Call the handler
    const response = await POST(request);

    // Assertions
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(201);

    const responseData = await response.json();
    expect(responseData.message).toBe("Contact form submitted successfully");
    expect(Contact.create).toHaveBeenCalledWith(requestData);

    // Verify nodemailer was called
    expect(nodemailer.createTransport).toHaveBeenCalled();
    const transporterMock = nodemailer.createTransport();
    expect(transporterMock.sendMail).toHaveBeenCalled();

    // Verify email content
    const emailCall = (transporterMock.sendMail as jest.Mock).mock.calls[0][0];
    expect(emailCall.subject).toContain("New Contact Form Submission");
    expect(emailCall.html).toContain(requestData.name);
    expect(emailCall.html).toContain(requestData.email);
    expect(emailCall.html).toContain(requestData.phone);
    expect(emailCall.html).toContain(requestData.eventDate);
    expect(emailCall.html).toContain(requestData.message);
  });

  it("should continue with request if email sending fails", async () => {
    // Mock request data
    const requestData = {
      name: "Test User",
      email: "test@example.com",
      phone: "(210) 555-1234",
      eventDate: "2025-05-15",
      message: "This is a test message",
    };

    // Mock the Contact.create method
    (Contact.create as jest.Mock).mockResolvedValue({
      _id: "mock-id",
      ...requestData,
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Mock nodemailer to throw an error
    const sendMailMock = jest
      .fn()
      .mockRejectedValue(new Error("Email sending failed"));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });

    // Create a mock request
    const request = new Request("http://localhost:3000/api/v1/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Call the handler
    const response = await POST(request);

    // Assertions
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(201);

    const responseData = await response.json();
    expect(responseData.message).toBe("Contact form submitted successfully");
    expect(Contact.create).toHaveBeenCalledWith(requestData);

    // Verify nodemailer was called
    expect(nodemailer.createTransport).toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalled();

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain(
      "Error sending contact notification email",
    );

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  it("should return 400 for invalid data", async () => {
    // Mock invalid request data (missing required fields)
    const requestData = {
      name: "Test User",
      // Missing email and other required fields
    };

    // Mock Contact.create to throw a validation error
    (Contact.create as jest.Mock).mockRejectedValue({
      name: "ValidationError",
      message: "Contact validation failed: email: Path `email` is required.",
    });

    // Create a mock request
    const request = new Request("http://localhost:3000/api/v1/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    // Call the handler
    const response = await POST(request);

    // Assertions
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(400);

    const responseData = await response.json();
    expect(responseData.message).toBe("Invalid contact data");
  });
});

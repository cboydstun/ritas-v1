import { GET, PUT, DELETE } from "../route";
import { NextResponse } from "next/server";
import { Contact } from "@/models/contact";
import { getServerSession } from "next-auth";

// Mock the MongoDB connection
jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

// Mock the Contact model
jest.mock("@/models/contact", () => ({
  Contact: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

// Mock next-auth
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

// Mock auth options
jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

describe("Admin Contact API - Single Contact Operations", () => {
  const mockContactId = "mock-contact-id";
  const mockContext = {
    params: Promise.resolve({ id: mockContactId }),
  };
  const mockRequest = new Request(
    "http://localhost:3000/api/admin/contacts/mock-contact-id",
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/admin/contacts/[id]", () => {
    it("should return 401 if not authenticated", async () => {
      // Mock unauthenticated session
      (getServerSession as jest.Mock).mockResolvedValue(null);

      // Call the handler
      const response = await GET(mockRequest, mockContext);

      // Assertions
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);

      const responseData = await response.json();
      expect(responseData.message).toBe("Unauthorized");
    });

    it("should return 401 if not admin", async () => {
      // Mock authenticated non-admin session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "user" },
      });

      // Call the handler
      const response = await GET(mockRequest, mockContext);

      // Assertions
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);

      const responseData = await response.json();
      expect(responseData.message).toBe("Unauthorized");
    });

    it("should return 404 if contact not found", async () => {
      // Mock authenticated admin session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "admin" },
      });

      // Mock Contact.findById to return null (not found)
      (Contact.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      // Call the handler
      const response = await GET(mockRequest, mockContext);

      // Assertions
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(404);

      const responseData = await response.json();
      expect(responseData.message).toBe("Contact not found");
    });

    it("should return contact if authenticated as admin and contact exists", async () => {
      // Mock authenticated admin session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "admin" },
      });

      // Mock contact data
      const mockContact = {
        _id: mockContactId,
        name: "Test User",
        email: "test@example.com",
        phone: "(210) 555-1234",
        eventDate: "2025-05-15",
        message: "Test message",
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock Contact.findById
      (Contact.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockContact),
      });

      // Call the handler
      const response = await GET(mockRequest, mockContext);

      // Assertions
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual(mockContact);
    });
  });

  describe("PUT /api/admin/contacts/[id]", () => {
    const updateRequest = new Request(
      "http://localhost:3000/api/admin/contacts/mock-contact-id",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Updated Name",
          status: "in-progress",
        }),
      },
    );

    it("should return 401 if not authenticated", async () => {
      // Mock unauthenticated session
      (getServerSession as jest.Mock).mockResolvedValue(null);

      // Call the handler
      const response = await PUT(updateRequest, mockContext);

      // Assertions
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);

      const responseData = await response.json();
      expect(responseData.message).toBe("Unauthorized");
    });

    it("should update contact if authenticated as admin", async () => {
      // Mock authenticated admin session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "admin" },
      });

      // Mock updated contact
      const mockUpdatedContact = {
        _id: mockContactId,
        name: "Updated Name",
        email: "test@example.com",
        phone: "(210) 555-1234",
        eventDate: "2025-05-15",
        message: "Test message",
        status: "in-progress",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock Contact.findByIdAndUpdate
      (Contact.findByIdAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUpdatedContact),
      });

      // Call the handler
      const response = await PUT(updateRequest, mockContext);

      // Assertions
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual(mockUpdatedContact);
    });
  });

  describe("DELETE /api/admin/contacts/[id]", () => {
    it("should return 401 if not authenticated", async () => {
      // Mock unauthenticated session
      (getServerSession as jest.Mock).mockResolvedValue(null);

      // Call the handler
      const response = await DELETE(mockRequest, mockContext);

      // Assertions
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);

      const responseData = await response.json();
      expect(responseData.message).toBe("Unauthorized");
    });

    it("should delete contact if authenticated as admin", async () => {
      // Mock authenticated admin session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "admin" },
      });

      // Mock deleted contact
      const mockDeletedContact = {
        _id: mockContactId,
        name: "Test User",
        email: "test@example.com",
      };

      // Mock Contact.findByIdAndDelete
      (Contact.findByIdAndDelete as jest.Mock).mockResolvedValue(
        mockDeletedContact,
      );

      // Call the handler
      const response = await DELETE(mockRequest, mockContext);

      // Assertions
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.message).toBe("Contact deleted successfully");
    });

    it("should return 404 if contact not found", async () => {
      // Mock authenticated admin session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "admin" },
      });

      // Mock Contact.findByIdAndDelete to return null (not found)
      (Contact.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

      // Call the handler
      const response = await DELETE(mockRequest, mockContext);

      // Assertions
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(404);

      const responseData = await response.json();
      expect(responseData.message).toBe("Contact not found");
    });
  });
});

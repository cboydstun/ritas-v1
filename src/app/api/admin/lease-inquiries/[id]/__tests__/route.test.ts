/**
 * @jest-environment node
 */
import { GET, PUT, DELETE } from "../route";
import { NextResponse } from "next/server";
import { LeaseInquiry } from "@/models/leaseInquiry";
import { getServerSession } from "next-auth";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/leaseInquiry", () => ({
  LeaseInquiry: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

describe("Admin Lease Inquiry API - Single Inquiry Operations", () => {
  const mockId = "mock-inquiry-id";
  const mockContext = {
    params: Promise.resolve({ id: mockId }),
  };
  const mockRequest = new Request(
    "http://localhost:3000/api/admin/lease-inquiries/mock-inquiry-id",
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/admin/lease-inquiries/[id]", () => {
    it("should return 401 if not authenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const response = await GET(mockRequest, mockContext);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);

      const responseData = await response.json();
      expect(responseData.message).toBe("Unauthorized");
    });

    it("should return 401 if not admin", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "user" },
      });

      const response = await GET(mockRequest, mockContext);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);
    });

    it("should return 404 if inquiry not found", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "admin" },
      });

      (LeaseInquiry.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const response = await GET(mockRequest, mockContext);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(404);

      const responseData = await response.json();
      expect(responseData.message).toBe("Lease inquiry not found");
    });

    it("should return inquiry if authenticated as admin and inquiry exists", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "admin" },
      });

      const now = new Date().toISOString();
      const mockInquiry = {
        _id: mockId,
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
        message: "Looking for a single tank.",
        status: "new",
        createdAt: now,
        updatedAt: now,
      };

      (LeaseInquiry.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockInquiry),
      });

      const response = await GET(mockRequest, mockContext);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual(mockInquiry);
    });
  });

  describe("PUT /api/admin/lease-inquiries/[id]", () => {
    const updateRequest = new Request(
      "http://localhost:3000/api/admin/lease-inquiries/mock-inquiry-id",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "contacted" }),
      },
    );

    it("should return 401 if not authenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const response = await PUT(updateRequest, mockContext);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);
    });

    it("should update inquiry if authenticated as admin", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "admin" },
      });

      const now = new Date().toISOString();
      const mockUpdated = {
        _id: mockId,
        businessName: "Casa Test Cantina",
        status: "contacted",
        createdAt: now,
        updatedAt: now,
      };

      (LeaseInquiry.findByIdAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUpdated),
      });

      const response = await PUT(updateRequest, mockContext);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual(mockUpdated);
    });
  });

  describe("DELETE /api/admin/lease-inquiries/[id]", () => {
    it("should return 401 if not authenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const response = await DELETE(mockRequest, mockContext);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);
    });

    it("should delete inquiry if authenticated as admin", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "admin" },
      });

      (LeaseInquiry.findByIdAndDelete as jest.Mock).mockResolvedValue({
        _id: mockId,
        businessName: "Casa Test Cantina",
      });

      const response = await DELETE(mockRequest, mockContext);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.message).toBe("Lease inquiry deleted successfully");
    });

    it("should return 404 if inquiry not found", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { role: "admin" },
      });

      (LeaseInquiry.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

      const response = await DELETE(mockRequest, mockContext);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(404);

      const responseData = await response.json();
      expect(responseData.message).toBe("Lease inquiry not found");
    });
  });
});

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";

export async function GET() {
  try {
    await dbConnect();

    // Find rentals with failed QuickBooks sync
    const failedRentals = await Rental.find({
      $or: [
        { "quickbooks.syncStatus": "failed" },
        { "quickbooks.syncStatus": "auth_error" },
      ],
    }).sort({ "quickbooks.lastSyncAttempt": -1 });

    // Format the data for the frontend
    const invoices = failedRentals.map((rental) => ({
      id: rental._id.toString(),
      rentalDate: rental.rentalDate,
      customerName: rental.customer.name,
      syncStatus: rental.quickbooks?.syncStatus || "failed",
      syncError: rental.quickbooks?.syncError || "Unknown error",
      lastAttempt: rental.quickbooks?.lastSyncAttempt
        ? new Date(rental.quickbooks.lastSyncAttempt).toLocaleString()
        : "Never",
      nextRetry: rental.quickbooks?.nextRetryAt
        ? new Date(rental.quickbooks.nextRetryAt).toLocaleString()
        : "Not scheduled",
    }));

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Error fetching failed invoices:", error);
    return NextResponse.json(
      { message: "Failed to fetch failed invoices" },
      { status: 500 },
    );
  }
}

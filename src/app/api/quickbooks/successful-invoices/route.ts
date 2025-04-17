import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";

export async function GET() {
  try {
    await dbConnect();

    // Find rentals with successful QuickBooks sync
    const successfulRentals = await Rental.find({
      "quickbooks.syncStatus": { $in: ["success", "synced"] },
      "quickbooks.invoiceId": { $exists: true },
    }).sort({ "quickbooks.lastSyncAttempt": -1 });

    // Format the data for the frontend
    const invoices = successfulRentals.map((rental) => ({
      id: rental._id.toString(),
      rentalDate: rental.rentalDate,
      customerName: rental.customer.name,
      syncStatus: "success",
      syncDate: rental.quickbooks?.lastSyncAttempt
        ? new Date(rental.quickbooks.lastSyncAttempt).toLocaleString()
        : "Unknown",
      qbInvoiceId: rental.quickbooks?.invoiceId || "Unknown",
    }));

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Error fetching successful invoices:", error);
    return NextResponse.json(
      { message: "Failed to fetch successful invoices" },
      { status: 500 },
    );
  }
}

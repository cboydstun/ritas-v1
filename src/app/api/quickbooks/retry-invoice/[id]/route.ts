import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { generateQuickBooksInvoice } from "@/lib/quickbooks-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rentalId = params.id;
    
    if (!rentalId) {
      return NextResponse.json(
        { message: "Missing rental ID" },
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    // Find the rental
    const rental = await Rental.findById(rentalId);
    
    if (!rental) {
      return NextResponse.json(
        { message: "Rental not found" },
        { status: 404 }
      );
    }
    
    // Reset retry count and sync status
    await Rental.findByIdAndUpdate(rentalId, {
      $set: {
        "quickbooks.syncStatus": "pending",
        "quickbooks.lastSyncAttempt": new Date(),
        "quickbooks.syncError": null,
      }
    });
    
    // Generate the invoice
    try {
      const invoice = await generateQuickBooksInvoice(rental);
      
      // Update the rental with the invoice ID
      await Rental.findByIdAndUpdate(rentalId, {
        $set: {
          "quickbooks.syncStatus": "synced",
          "quickbooks.invoiceId": invoice.Id,
          "quickbooks.invoiceNumber": invoice.DocNumber,
        }
      });
      
      return NextResponse.json({
        success: true,
        message: "Invoice generated successfully",
        invoice: {
          id: invoice.Id,
          number: invoice.DocNumber
        }
      });
    } catch (error) {
      console.error("Error retrying invoice generation:", error);
      
      // The error will be logged by the generateQuickBooksInvoice function
      
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to generate invoice"
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error processing retry request:", error);
    return NextResponse.json(
      { 
        success: false,
        message: "Failed to process retry request",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

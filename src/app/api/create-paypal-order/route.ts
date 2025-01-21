import { NextResponse } from "next/server";
import { initializePayPalSDK } from "@/lib/paypal-server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import mongoose from "mongoose";

export async function POST(request: Request) {
  try {
    const { amount, currency, rentalData } = await request.json();

    if (!amount || !currency) {
      return NextResponse.json(
        { message: "Missing required payment details" },
        { status: 400 },
      );
    }

    // Import PayPal SDK dynamically
    const sdk = await import("@paypal/checkout-server-sdk");

    const paypalClient = await initializePayPalSDK();
    // @ts-expect-error: TypeScript does not recognize OrdersCreateRequest
    const request_ = new sdk.default.orders.OrdersCreateRequest();

    request_.prefer("return=representation");
    request_.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toString(),
          },
        },
      ],
    });

    const order = await paypalClient.execute(request_);

    // If rental data is provided, create a pending rental
    if (rentalData) {
      try {
        await dbConnect();

        // Create a new rental with pending status
        const rental = new Rental({
          machineType: rentalData.machineType,
          capacity: rentalData.capacity,
          mixerType: rentalData.mixerType,
          price: rentalData.price,
          rentalDate: rentalData.rentalDate,
          rentalTime: rentalData.rentalTime,
          returnDate: rentalData.returnDate,
          returnTime: rentalData.returnTime,
          customer: {
            name: rentalData.customer.name,
            email: rentalData.customer.email,
            phone: rentalData.customer.phone,
            address: {
              street: rentalData.customer.address.street,
              city: rentalData.customer.address.city,
              state: rentalData.customer.address.state,
              zipCode: rentalData.customer.address.zipCode
            }
          },
          notes: rentalData.notes || '',
          paypalOrderId: order.result.id,
          status: 'pending',
          payment: {
            paypalTransactionId: order.result.id,
            amount: parseFloat(amount),
            status: 'pending',
            date: new Date()
          }
        });

        // Save the rental
        const savedRental = await rental.save();

        return NextResponse.json({ 
          id: order.result.id,
          rentalId: savedRental._id
        });
      } catch (dbError) {
        console.error("Error saving rental:", dbError);
        if (dbError instanceof Error) {
          console.error("Error details:", {
            name: dbError.name,
            message: dbError.message,
            stack: dbError.stack
          });
        }
        // Even if saving the rental fails, return the PayPal order ID
        // as the payment flow can still continue
        return NextResponse.json({ id: order.result.id });
      }
    }

    // If no rental data, just return the PayPal order ID
    return NextResponse.json({ id: order.result.id });
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create order" },
      { status: 500 },
    );
  }
}

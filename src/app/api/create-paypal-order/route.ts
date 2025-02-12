import { NextResponse } from "next/server";
import { initializePayPalSDK } from "@/lib/paypal-server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { withAxiom, AxiomRequest, LogLevel } from "next-axiom";

export const POST = withAxiom(async (request: AxiomRequest) => {
  const log = request.log.with({ scope: "create-paypal-order" });
  
  try {
    const { amount, currency, rentalData } = await request.json();
    log.info("Received PayPal order request", { amount, currency });

    if (!amount || !currency) {
      log.warn("Missing payment details", { amount, currency });
      return NextResponse.json(
        { message: "Missing required payment details" },
        { status: 400 },
      );
    }

    // Import PayPal SDK dynamically
    const sdk = await import("@paypal/checkout-server-sdk");
    log.debug("PayPal SDK imported");

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
    log.info("PayPal order created", { orderId: order.result.id });

    // If rental data is provided, create a pending rental
    if (rentalData) {
      try {
        await dbConnect();
        log.debug("Database connection established");

        // Create a new rental with pending status
        const rental = new Rental({
          machineType: rentalData.machineType,
          capacity: rentalData.capacity,
          selectedMixers: rentalData.selectedMixers,
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
              zipCode: rentalData.customer.address.zipCode,
            },
          },
          notes: rentalData.notes || "",
          paypalOrderId: order.result.id,
          status: "pending",
          payment: {
            paypalTransactionId: order.result.id,
            amount: parseFloat(amount),
            status: "pending",
            date: new Date(),
          },
        });

        // Save the rental
        const savedRental = await rental.save();
        log.info("Rental saved successfully", { 
          rentalId: savedRental._id,
          paypalOrderId: order.result.id 
        });

        return NextResponse.json({
          id: order.result.id,
          rentalId: savedRental._id,
        });
      } catch (dbError) {
        log.error("Database error while saving rental", {
          error: dbError instanceof Error ? {
            name: dbError.name,
            message: dbError.message,
            stack: dbError.stack,
          } : dbError,
          paypalOrderId: order.result.id
        });
        
        // Even if saving the rental fails, return the PayPal order ID
        // as the payment flow can still continue
        return NextResponse.json({ id: order.result.id });
      }
    }

    // If no rental data, just return the PayPal order ID
    return NextResponse.json({ id: order.result.id });
  } catch (error) {
    log.error("Error creating PayPal order", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      details: error && typeof error === "object" && "details" in error ? error.details : undefined
    });

    let errorMessage = "Failed to create order";
    if (error instanceof Error) {
      errorMessage = `PayPal Error: ${error.message}`;
    }

    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}, {
  logRequestDetails: ["body", "nextUrl"],
  notFoundLogLevel: LogLevel.error,
  redirectLogLevel: LogLevel.info
});

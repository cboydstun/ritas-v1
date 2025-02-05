import { NextResponse } from "next/server";
import { initializePayPalSDK } from "@/lib/paypal-server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import twilio from "twilio";

export async function POST(request: Request) {
  try {
    const { orderId, amount, rentalData } = await request.json();

    if (!orderId || !amount) {
      return NextResponse.json(
        { message: "Missing required data" },
        { status: 400 },
      );
    }

    // Import PayPal SDK dynamically
    const sdk = await import("@paypal/checkout-server-sdk");

    const paypalClient = await initializePayPalSDK();
    // @ts-expect-error: TypeScript does not recognize OrdersCaptureRequest
    const request_ = new sdk.default.orders.OrdersCaptureRequest(orderId);
    const capture = await paypalClient.execute(request_);

    if (capture.result.status === "COMPLETED") {
      // Send SMS notification if Twilio credentials are configured
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromPhone = process.env.TWILIO_PHONE_NUMBER;
      const toPhone = process.env.USER_PHONE_NUMBER;

      if (accountSid && authToken && fromPhone && toPhone) {
        const twilioClient = twilio(accountSid, authToken);
        try {
          // Get rental data from either new rental data or existing rental
          const rental =
            rentalData || (await Rental.findOne({ paypalOrderId: orderId }));
          if (rental) {
            // Parse the rental date and time
            const [year, month, day] = rental.rentalDate.split("-");
            const [hour] = rental.rentalTime.split(":");
            const rentalDateTime = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
            );

            // Format the date and time
            const formattedDate = rentalDateTime.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });

            // Format time to 12-hour format
            const formattedTime = `${rental.rentalTime}${parseInt(hour) >= 12 ? "PM" : "AM"}`;

            await twilioClient.messages.create({
              body:
                `Slushy Machine Rental!\n` +
                `Date: ${formattedDate}\n` +
                `Time: ${formattedTime}\n` +
                `Address: ${rental.customer.address.street}, ${rental.customer.address.city}, ${rental.customer.address.state} ${rental.customer.address.zipCode}\n` +
                `Machine: ${rental.machineType}\n` +
                `Mixer: ${rental.mixerType}\n` +
                `Customer: ${rental.customer.name}\n` +
                `Phone: ${rental.customer.phone}\n` +
                `Total: $${amount}`,
              from: fromPhone,
              to: toPhone,
            });
          }
        } catch (smsError) {
          console.error("Error sending SMS:", smsError);
          // Continue with order processing even if SMS fails
        }
      } else {
        console.warn(
          "Twilio credentials not fully configured - skipping SMS notification",
        );
      }

      // Connect to MongoDB using Mongoose
      await dbConnect();

      // First try to find the rental
      const existingRental = await Rental.findOne({ paypalOrderId: orderId });

      if (!existingRental && rentalData) {
        // If rental not found but we have rental data, create it
        const rental = new Rental({
          ...rentalData,
          paypalOrderId: orderId,
          status: "confirmed",
          payment: {
            paypalTransactionId: capture.result.id,
            amount: parseFloat(amount),
            status: "completed",
            date: new Date(),
          },
        });
        await rental.save();
        return NextResponse.json({
          id: capture.result.id,
          status: capture.result.status,
          rental: rental.toObject(),
        });
      }

      if (!existingRental) {
        console.error("No rental found for PayPal order:", orderId);
        throw new Error("Rental not found and no rental data provided");
      }

      // Update the existing rental
      const updatedRental = await Rental.findOneAndUpdate(
        { paypalOrderId: orderId },
        {
          $set: {
            status: "confirmed",
            payment: {
              paypalTransactionId: capture.result.id,
              amount: parseFloat(amount),
              status: "completed",
              date: new Date(),
            },
            updatedAt: new Date(),
          },
        },
        {
          new: true, // Return the updated document
          runValidators: true, // Run schema validators on update
        },
      );

      if (!updatedRental) {
        throw new Error("Failed to update rental");
      }

      return NextResponse.json({
        id: capture.result.id,
        status: capture.result.status,
        rental: updatedRental.toObject(),
      });
    } else {
      // Update rental payment status to failed if capture wasn't successful
      await dbConnect();
      const rental = await Rental.findOneAndUpdate(
        { paypalOrderId: orderId },
        {
          $set: {
            "payment.status": "failed",
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!rental) {
        console.error("No rental found for PayPal order:", orderId);
        throw new Error("Rental not found for failed payment");
      }

      throw new Error("Payment capture failed");
    }
  } catch (error) {
    console.error("Error capturing PayPal payment:", error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }

    // Check if it's a PayPal API error
    if (error && typeof error === "object" && "details" in error) {
      console.error("PayPal API error details:", error.details);
    }

    let errorMessage = "Failed to capture payment";
    if (error instanceof Error) {
      errorMessage = `PayPal Error: ${error.message}`;
    }

    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}

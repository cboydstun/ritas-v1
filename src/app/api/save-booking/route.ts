import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import twilio from "twilio";
import { Resend } from "resend";
import { nanoid } from "nanoid";

export async function POST(request: Request) {
  try {
    const { rentalData } = await request.json();

    if (!rentalData) {
      return NextResponse.json(
        { message: "Missing rental data" },
        { status: 400 },
      );
    }

    // Generate a unique booking ID
    const bookingId = nanoid(10).toUpperCase();

    // Connect to MongoDB
    await dbConnect();

    // Create a new rental with pending payment status
    const rental = new Rental({
      ...rentalData,
      selectedExtras: rentalData.selectedExtras || [],
      isServiceDiscount: rentalData.isServiceDiscount || false,
      bookingId,
      status: "pending_payment", // Different from "pending" - indicates we're waiting for manual payment
      payment: {
        paypalTransactionId: null, // No PayPal transaction
        amount: parseFloat(rentalData.price),
        status: "pending",
        date: new Date(),
      },
    });

    const savedRental = await rental.save();

    // Send SMS notification if Twilio credentials are configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    const toPhone = process.env.USER_PHONE_NUMBER;

    if (accountSid && authToken && fromPhone && toPhone) {
      const twilioClient = twilio(accountSid, authToken);
      try {
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

        // Prepare extras text if any
        const extrasText =
          rental.selectedExtras && rental.selectedExtras.length > 0
            ? `Extras: ${rental.selectedExtras
                .map(
                  (extra: { name: string; quantity?: number }) =>
                    `${extra.name}${extra.quantity && extra.quantity > 1 ? ` (${extra.quantity}x)` : ""}`,
                )
                .join(", ")}\n`
            : "";

        await twilioClient.messages.create({
          body:
            `🎉 NEW BOOKING - PAYMENT PENDING\n` +
            `Booking ID: ${bookingId}\n` +
            `Date: ${formattedDate}\n` +
            `Time: ${formattedTime}\n` +
            `Address: ${rental.customer.address.street}, ${rental.customer.address.city}, ${rental.customer.address.state} ${rental.customer.address.zipCode}\n` +
            `Machine: ${rental.machineType}\n` +
            `Mixers: ${rental.selectedMixers.join(", ") || "None"}\n` +
            `${extrasText}` +
            `Customer: ${rental.customer.name}\n` +
            `Phone: ${rental.customer.phone}\n` +
            `Total: $${rentalData.price}\n` +
            `⚠️ INVOICE CUSTOMER FOR PAYMENT`,
          from: fromPhone,
          to: toPhone,
        });
      } catch (smsError) {
        console.error("Error sending SMS:", smsError);
        // Continue with order processing even if SMS fails
      }
    } else {
      console.warn(
        "Twilio credentials not fully configured - skipping SMS notification",
      );
    }

    // Configure Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      // Send confirmation email to customer
      await resend.emails.send({
        from: "SATX Ritas Rentals <bookings@satxritas.com>",
        to: [rental.customer.email],
        bcc: ["satxbounce@gmail.com"], // BCC the business email
        subject: "SATX Ritas Margarita Rentals - Booking Confirmation",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb; border-radius: 8px;">
          <h1 style="color: #2b6cb0; text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">Booking Confirmed!</h1>
          <p style="font-size: 16px;">Dear ${rental.customer.name},</p>
          <p style="font-size: 16px;">Thank you for booking with SATX Ritas! Your rental for a ${rental.machineType} machine has been confirmed.</p>
          
          <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0;"><strong style="color: #2b6cb0;">Booking ID:</strong> ${bookingId}</p>
          </div>

          <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Rental Details:</strong></p>
            <ul style="list-style-type: none; padding: 0; margin: 0;">
              <li style="margin-bottom: 8px;">🗓 Rental Date: ${rental.rentalDate} at ${rental.rentalTime}</li>
              <li style="margin-bottom: 8px;">🗓 Return Date: ${rental.returnDate} at ${rental.returnTime}</li>
              <li style="margin-bottom: 8px;">🍹 Selected Mixers: ${rental.selectedMixers.join(", ")}</li>
              ${
                rental.selectedExtras && rental.selectedExtras.length > 0
                  ? `<li style="margin-bottom: 8px;">🎉 Party Extras: ${rental.selectedExtras
                      .map(
                        (extra: { name: string; quantity?: number }) =>
                          `${extra.name}${extra.quantity && extra.quantity > 1 ? ` (${extra.quantity}x)` : ""}`,
                      )
                      .join(", ")}</li>`
                  : ""
              }
              <li style="margin-bottom: 8px;">💰 Total Amount: $${rentalData.price}</li>
              <li style="margin-bottom: 8px;">⚡ Machine Capacity: ${rental.capacity}L</li>
            </ul>
          </div>

          <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Delivery Address:</strong></p>
            <p style="margin: 0;">
              ${rental.customer.address.street}<br>
              ${rental.customer.address.city}, ${rental.customer.address.state} ${rental.customer.address.zipCode}
            </p>
          </div>

          <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Contact Information:</strong></p>
            <ul style="list-style-type: none; padding: 0; margin: 0;">
              <li style="margin-bottom: 8px;">📱 Phone: ${rental.customer.phone}</li>
              <li style="margin-bottom: 8px;">📧 Email: ${rental.customer.email}</li>
            </ul>
          </div>

          <div style="background-color: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #92400e;">💳 Payment Information</h3>
            <p style="margin: 0; color: #92400e; font-weight: 500;">
              We will send you an invoice for payment separately. You can pay by cash, check, or card when we deliver your rental.
            </p>
          </div>

          <p style="font-size: 16px; background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            If you have any questions or need to make changes to your booking, please don't hesitate to contact us. 
            Please reference your Booking ID <strong>${bookingId}</strong> in any communications.
          </p>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
            Best regards,<br>
            SATX Ritas Margarita Rentals Team
          </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError);
      // Continue with the booking process even if email fails
    }

    return NextResponse.json({
      success: true,
      bookingId,
      rentalId: savedRental._id.toString(),
      message: "Booking confirmed successfully",
    });
  } catch (error) {
    console.error("Error saving booking:", error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }

    return NextResponse.json(
      {
        message: "Failed to save booking",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

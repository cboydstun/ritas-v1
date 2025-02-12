import { NextResponse } from "next/server";
import { initializePayPalSDK } from "@/lib/paypal-server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import twilio from "twilio";
import nodemailer from "nodemailer";
import { withAxiom, AxiomRequest, LogLevel } from "next-axiom";

export const POST = withAxiom(async (request: AxiomRequest) => {
  const log = request.log.with({ scope: "capture-paypal-order" });
  
  try {
    const { orderId, amount, rentalData } = await request.json();
    log.info("Received capture request", { orderId, amount });

    if (!orderId || !amount) {
      log.warn("Missing required data", { orderId, amount });
      return NextResponse.json(
        { message: "Missing required data" },
        { status: 400 },
      );
    }

    // Import PayPal SDK dynamically
    const sdk = await import("@paypal/checkout-server-sdk");
    log.debug("PayPal SDK imported");

    const paypalClient = await initializePayPalSDK();
    // @ts-expect-error: TypeScript does not recognize OrdersCaptureRequest
    const request_ = new sdk.default.orders.OrdersCaptureRequest(orderId);
    const capture = await paypalClient.execute(request_);
    log.info("PayPal capture executed", { 
      orderId,
      captureId: capture.result.id,
      status: capture.result.status 
    });

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
                `Mixers: ${rental.selectedMixers.join(", ") || "None"}\n` +
                `Customer: ${rental.customer.name}\n` +
                `Phone: ${rental.customer.phone}\n` +
                `Total: $${amount}`,
              from: fromPhone,
              to: toPhone,
            });
            log.info("SMS notification sent", { orderId });
          }
        } catch (smsError) {
          log.error("Error sending SMS", {
            error: smsError instanceof Error ? {
              name: smsError.name,
              message: smsError.message,
              stack: smsError.stack,
            } : smsError,
            orderId
          });
          // Continue with order processing even if SMS fails
        }
      } else {
        log.warn("Twilio credentials not fully configured - skipping SMS notification");
      }

      // Connect to MongoDB using Mongoose
      await dbConnect();
      log.debug("Database connection established");

      // First try to find the rental
      const existingRental = await Rental.findOne({ paypalOrderId: orderId });
      log.debug("Existing rental lookup complete", { 
        exists: !!existingRental,
        orderId 
      });

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
        log.info("New rental created", { 
          rentalId: rental._id,
          orderId 
        });
        return NextResponse.json({
          id: capture.result.id,
          status: capture.result.status,
          rental: rental.toObject(),
        });
      }

      if (!existingRental) {
        const error = new Error("Rental not found and no rental data provided");
        log.error("Rental lookup failed", {
          error: {
            message: error.message,
            stack: error.stack
          },
          orderId
        });
        throw error;
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
          new: true,
          runValidators: true,
        },
      );

      if (!updatedRental) {
        const error = new Error("Failed to update rental");
        log.error("Rental update failed", {
          error: {
            message: error.message,
            stack: error.stack
          },
          orderId
        });
        throw error;
      }

      log.info("Rental updated successfully", {
        rentalId: updatedRental._id,
        orderId,
        status: "confirmed"
      });

      // Configure nodemailer
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.NODEMAILER_USERNAME,
          pass: process.env.NODEMAILER_PASSWORD,
        },
      });

      try {
        // Send confirmation email
        await transporter.sendMail({
          from: process.env.NODEMAILER_USERNAME,
          to: process.env.NODEMAILER_USERNAME,
          // bcc: updatedRental.customer.email,
          subject: "SATX Ritas Margarita Rentals - Order Confirmation",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb; border-radius: 8px;">
            <h1 style="color: #2b6cb0; text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">Thank you for your order!</h1>
            <p style="font-size: 16px;">Dear ${updatedRental.customer.name},</p>
            <p style="font-size: 16px;">We have received your rental order for a ${updatedRental.machineType}.</p>
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0;"><strong style="color: #2b6cb0;">Order ID:</strong> ${orderId}</p>
            </div>
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Rental Details:</strong></p>
              <ul style="list-style-type: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 8px;">🗓 Rental Date: ${updatedRental.rentalDate} at ${updatedRental.rentalTime}</li>
                <li style="margin-bottom: 8px;">🗓 Return Date: ${updatedRental.returnDate} at ${updatedRental.returnTime}</li>
                <li style="margin-bottom: 8px;">🍹 Selected Mixers: ${updatedRental.selectedMixers.join(", ")}</li>
                <li style="margin-bottom: 8px;">💰 Total Amount: $${amount}</li>
                <li style="margin-bottom: 8px;">⚡ Machine Capacity: ${updatedRental.capacity}L</li>
              </ul>
            </div>
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Delivery Address:</strong></p>
              <p style="margin: 0;">
                ${updatedRental.customer.address.street}<br>
                ${updatedRental.customer.address.city}, ${updatedRental.customer.address.state} ${updatedRental.customer.address.zipCode}
              </p>
            </div>
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Contact Information:</strong></p>
              <ul style="list-style-type: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 8px;">📱 Phone: ${updatedRental.customer.phone}</li>
                <li style="margin-bottom: 8px;">📧 Email: ${updatedRental.customer.email}</li>
              </ul>
            </div>
            <p style="font-size: 16px; background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">If you have any questions or need to make changes to your order, please don't hesitate to contact us. Please reference your Order ID in any communications.</p>
            <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0;">Best regards,<br>SATX Ritas Margarita Rentals Team</p>
            </div>
          `,
        });
        log.info("Confirmation email sent", { orderId });
      } catch (emailError) {
        log.error("Error sending confirmation email", {
          error: emailError instanceof Error ? {
            name: emailError.name,
            message: emailError.message,
            stack: emailError.stack,
          } : emailError,
          orderId
        });
        // Continue with the order process even if email fails
      }

      return NextResponse.json({
        id: capture.result.id,
        status: capture.result.status,
        rental: updatedRental.toObject(),
      });
    } else {
      log.warn("Payment capture unsuccessful", { 
        orderId,
        captureStatus: capture.result.status 
      });
      
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
        const error = new Error("Rental not found for failed payment");
        log.error("Failed payment rental lookup failed", {
          error: {
            message: error.message,
            stack: error.stack
          },
          orderId
        });
        throw error;
      }

      log.info("Rental updated with failed payment status", {
        rentalId: rental._id,
        orderId
      });

      throw new Error("Payment capture failed");
    }
  } catch (error) {
    log.error("Error capturing PayPal payment", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      details: error && typeof error === "object" && "details" in error ? error.details : undefined
    });

    let errorMessage = "Failed to capture payment";
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

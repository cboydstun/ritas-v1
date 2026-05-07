import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { LeaseInquiry } from "@/models/leaseInquiry";
import { leaseTiers, type LeaseTierId } from "@/lib/lease-data";
import { Resend } from "resend";
import twilio from "twilio";

const tierNameById = (id: string) =>
  leaseTiers.find((t) => t.id === (id as LeaseTierId))?.name ?? id;

/**
 * API route for submitting a long-term lease inquiry
 * POST /api/v1/lease-inquiries
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();
    await dbConnect();

    const inquiry = await LeaseInquiry.create(data);

    const machinesList: string = (inquiry.machinesOfInterest ?? [])
      .map(tierNameById)
      .join(", ");

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    const toPhone = process.env.USER_PHONE_NUMBER;

    if (accountSid && authToken && fromPhone && toPhone) {
      try {
        const twilioClient = twilio(accountSid, authToken);
        await twilioClient.messages.create({
          body:
            `New Lease Inquiry!\n` +
            `Business: ${inquiry.businessName} (${inquiry.businessType})\n` +
            `Contact: ${inquiry.contactName}\n` +
            `Email: ${inquiry.email}\n` +
            `Phone: ${inquiry.phone}\n` +
            `Term: ${inquiry.preferredTerm}\n` +
            `Machines: ${machinesList}\n` +
            `Submitted: ${new Date().toLocaleString()}`,
          from: fromPhone,
          to: toPhone,
        });
      } catch (smsError) {
        console.error("Error sending SMS notification:", smsError);
      }
    } else {
      console.warn(
        "Twilio credentials not fully configured - skipping SMS notification",
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      await resend.emails.send({
        from: "SATX Ritas Rentals <contact@satxritas.com>",
        to: ["satxbounce@gmail.com"],
        subject: "New Long-Term Lease Inquiry - SATX Ritas",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb; border-radius: 8px;">
            <h1 style="color: #2b6cb0; text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">New Long-Term Lease Inquiry</h1>
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Business Details:</strong></p>
              <ul style="list-style-type: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 8px;"><strong>Business:</strong> ${inquiry.businessName}</li>
                <li style="margin-bottom: 8px;"><strong>Type:</strong> ${inquiry.businessType}</li>
                <li style="margin-bottom: 8px;"><strong>Contact:</strong> ${inquiry.contactName}</li>
                <li style="margin-bottom: 8px;"><strong>Email:</strong> ${inquiry.email}</li>
                <li style="margin-bottom: 8px;"><strong>Phone:</strong> ${inquiry.phone}</li>
                <li style="margin-bottom: 8px;"><strong>Address:</strong> ${inquiry.address.street}, ${inquiry.address.city}, ${inquiry.address.state} ${inquiry.address.zip}</li>
                <li style="margin-bottom: 8px;"><strong>Preferred Term:</strong> ${inquiry.preferredTerm}</li>
                <li style="margin-bottom: 8px;"><strong>Machines of Interest:</strong> ${machinesList || "(none specified)"}</li>
                <li style="margin-bottom: 8px;"><strong>Message:</strong> ${inquiry.message || "(none)"}</li>
                <li style="margin-bottom: 8px;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            <p style="font-size: 14px; color: #666;">This is an automated notification from your website lease inquiry form.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(
        "Error sending lease inquiry notification email:",
        emailError,
      );
    }

    return NextResponse.json(
      { message: "Lease inquiry submitted successfully" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating lease inquiry:", error);

    if (error instanceof Error && error.name === "ValidationError") {
      return NextResponse.json(
        {
          message: "Invalid lease inquiry data",
          details: error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Failed to submit lease inquiry" },
      { status: 500 },
    );
  }
}

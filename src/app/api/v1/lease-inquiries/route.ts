import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { LeaseInquiry } from "@/models/leaseInquiry";
import { leaseTiers, type LeaseTierId } from "@/lib/lease-data";
import { Resend } from "resend";
import twilio from "twilio";
import { guardPublicWrite } from "@/lib/api-guard";
import {
  escapeHtml,
  firstIssueMessage,
  leaseInquirySchema,
} from "@/lib/validation";
import { BUSINESS_TIME_ZONE } from "@/lib/dates";

const tierNameById = (id: string) =>
  leaseTiers.find((t) => t.id === (id as LeaseTierId))?.name ?? id;

/**
 * API route for submitting a long-term lease inquiry
 * POST /api/v1/lease-inquiries
 */
/**
 * Now, rendered in the business's timezone.
 *
 * Vercel functions run UTC, so a bare `toLocaleString()` stamped every evening
 * submission with tomorrow's date in the operator's SMS and email.
 */
function submittedAt(): string {
  return new Date().toLocaleString("en-US", { timeZone: BUSINESS_TIME_ZONE });
}

export async function POST(request: Request) {
  try {
    const guard = await guardPublicWrite(request, {
      route: "lease-inquiries",
      limit: 5,
      windowSeconds: 600,
    });
    if (!guard.ok) return guard.response;

    const parsed = leaseInquirySchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }

    await dbConnect();

    // Explicit fields only — `LeaseInquiry.create(rawBody)` let callers set
    // `status` and the timestamps.
    const inquiry = await LeaseInquiry.create({
      businessName: parsed.data.businessName,
      businessType: parsed.data.businessType,
      contactName: parsed.data.contactName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      preferredTerm: parsed.data.preferredTerm,
      machinesOfInterest: parsed.data.machinesOfInterest,
      message: parsed.data.message,
    });

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
            `Submitted: ${submittedAt()}`,
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

    try {
      // Inside the try: the Resend constructor throws when RESEND_API_KEY is
      // unset, and the document is already persisted at this point.
      const resend = new Resend(process.env.RESEND_API_KEY);

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
                <li style="margin-bottom: 8px;"><strong>Business:</strong> ${escapeHtml(inquiry.businessName)}</li>
                <li style="margin-bottom: 8px;"><strong>Type:</strong> ${escapeHtml(inquiry.businessType)}</li>
                <li style="margin-bottom: 8px;"><strong>Contact:</strong> ${escapeHtml(inquiry.contactName)}</li>
                <li style="margin-bottom: 8px;"><strong>Email:</strong> ${escapeHtml(inquiry.email)}</li>
                <li style="margin-bottom: 8px;"><strong>Phone:</strong> ${escapeHtml(inquiry.phone)}</li>
                <li style="margin-bottom: 8px;"><strong>Address:</strong> ${escapeHtml(inquiry.address.street)}, ${escapeHtml(inquiry.address.city)}, ${escapeHtml(inquiry.address.state)} ${escapeHtml(inquiry.address.zip)}</li>
                <li style="margin-bottom: 8px;"><strong>Preferred Term:</strong> ${escapeHtml(inquiry.preferredTerm)}</li>
                <li style="margin-bottom: 8px;"><strong>Machines of Interest:</strong> ${escapeHtml(machinesList) || "(none specified)"}</li>
                <li style="margin-bottom: 8px;"><strong>Message:</strong> ${escapeHtml(inquiry.message) || "(none)"}</li>
                <li style="margin-bottom: 8px;"><strong>Submitted:</strong> ${submittedAt()}</li>
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

    // Detail stays in the logs rather than going back to the caller.
    if (error instanceof Error && error.name === "ValidationError") {
      return NextResponse.json(
        { message: "Invalid lease inquiry data" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Failed to submit lease inquiry" },
      { status: 500 },
    );
  }
}

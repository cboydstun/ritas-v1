import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Thumbprint } from "@/models/thumbprint";
import { headers } from "next/headers";

/**
 * API route for storing fingerprint data
 * POST /api/v1/analytics/fingerprint
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Validate required fields
    if (!data.fingerprintHash) {
      console.error("Validation error: Missing fingerprintHash");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: fingerprintHash",
        },
        { status: 400 },
      );
    }

    if (!data.components) {
      console.error("Validation error: Missing components");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: components",
        },
        { status: 400 },
      );
    }

    // Connect to database with error handling
    try {
      await dbConnect();
    } catch (dbError) {
      console.error("Database connection error:", dbError);
      return NextResponse.json(
        {
          success: false,
          error:
            "Database connection failed. Analytics tracking temporarily unavailable.",
        },
        { status: 503 },
      );
    }

    // Get user agent from headers
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || data.userAgent || "";

    // Determine device type based on user agent
    let deviceType: "desktop" | "tablet" | "mobile" | "other" = "other";
    if (/mobile/i.test(userAgent)) {
      deviceType = "mobile";
    } else if (/tablet/i.test(userAgent)) {
      deviceType = "tablet";
    } else if (/windows|macintosh|linux/i.test(userAgent)) {
      deviceType = "desktop";
    }

    // Prepare the new visit data
    const newVisit = {
      timestamp: new Date(),
      page: data.page || "/",
      referrer: data.referrer || null,
      timeSpentMs: data.timeSpentMs || 0,
      formContext: data.formContext || {},
      fieldInteractions: data.fieldInteractions || [],
    };

    // Prepare funnel data updates if this is an order form page
    const stepName =
      data.page && data.page.startsWith("/order/")
        ? data.page.split("/").pop() || ""
        : null;

    // Check if this fingerprint already exists
    const existingThumbprint = await Thumbprint.findOne({
      fingerprintHash: data.fingerprintHash,
    });

    if (existingThumbprint) {
      // Use atomic findOneAndUpdate for existing records
      await Thumbprint.findOneAndUpdate(
        { fingerprintHash: data.fingerprintHash },
        {
          // Set fields
          $set: {
            lastSeen: new Date(),
            userAgent: userAgent,
            device: {
              ...existingThumbprint.device,
              type: deviceType,
              ...(data.device || {}),
            },
            ...(stepName && {
              "funnelData.exitStep": stepName,
              ...(stepName === "payment" &&
              existingThumbprint.funnelData?.completedSteps?.length === 4
                ? {
                    "conversion.hasConverted": true,
                    "conversion.conversionDate": new Date(),
                    "conversion.conversionType": "order_completed",
                  }
                : {}),
            }),
          },
          // Increment fields
          $inc: { visitCount: 1 },
          // Push to arrays
          $push: {
            visits: newVisit,
            ...(stepName &&
            !existingThumbprint.funnelData?.completedSteps?.includes(stepName)
              ? {
                  "funnelData.completedSteps": stepName,
                }
              : {}),
          },
        },
        { new: true }, // Return the updated document
      );

      return NextResponse.json({
        success: true,
        isNewVisitor: false,
        fingerprintHash: data.fingerprintHash,
      });
    } else {
      // Use findOneAndUpdate with upsert for new records
      // This handles the case where the document might have been created
      // between our check and insert
      await Thumbprint.findOneAndUpdate(
        { fingerprintHash: data.fingerprintHash },
        {
          $setOnInsert: {
            fingerprintHash: data.fingerprintHash,
            components: data.components,
            firstSeen: new Date(),
            visitCount: 1,
            userSegmentation: {
              userType: "new",
              deviceCategory: deviceType,
              acquisitionSource: data.referrer ? "referral" : "direct",
            },
          },
          $set: {
            lastSeen: new Date(),
            userAgent: userAgent,
            device: {
              type: deviceType,
              ...(data.device || {}),
            },
            ...(stepName && {
              "funnelData.entryStep": stepName,
              "funnelData.exitStep": stepName,
            }),
          },
          $push: {
            visits: newVisit,
            ...(stepName
              ? {
                  "funnelData.completedSteps": stepName,
                }
              : {}),
          },
        },
        {
          new: true,
          upsert: true,
        },
      );

      return NextResponse.json({
        success: true,
        isNewVisitor: true,
        fingerprintHash: data.fingerprintHash,
      });
    }
  } catch (error) {
    // Enhanced error logging
    console.error("Error processing fingerprint:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Return detailed error for development, generic for production
    const errorMessage =
      process.env.NODE_ENV === "development"
        ? `Failed to process fingerprint: ${error instanceof Error ? error.message : "Unknown error"}`
        : "Failed to process fingerprint";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}

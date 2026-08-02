import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Thumbprint } from "@/models/thumbprint";
import { headers } from "next/headers";
import { guardPublicWrite } from "@/lib/api-guard";
import { fingerprintHashSchema } from "@/lib/validation";

/**
 * Cap on retained per-visitor visit entries. `$push` was unbounded, so a
 * client pinning one hash could grow a single document past Mongo's 16 MB
 * limit, after which every write for that visitor fails permanently.
 */
const MAX_RETAINED_VISITS = 200;

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

/**
 * API route for storing fingerprint data
 * POST /api/v1/analytics/fingerprint
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await guardPublicWrite(req, {
      route: "fingerprint",
      limit: 60,
      windowSeconds: 600,
      maxBytes: 32 * 1024,
    });
    if (!guard.ok) return guard.response;

    const data = guard.data as Record<string, unknown>;

    // Must be a hex digest. A truthiness check let `{"$ne": null}` through,
    // which matched an arbitrary existing visitor document and then wrote to
    // it — an unauthenticated caller could overwrite anyone's analytics record.
    const hashResult = fingerprintHashSchema.safeParse(data?.fingerprintHash);
    if (!hashResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid field: fingerprintHash",
        },
        { status: 400 },
      );
    }
    const fingerprintHash = hashResult.data;

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
    const userAgent =
      headersList.get("user-agent") || asString(data.userAgent) || "";

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
    const page = asString(data.page, "/").slice(0, 500);
    const newVisit = {
      timestamp: new Date(),
      page,
      referrer: asString(data.referrer).slice(0, 500) || null,
      timeSpentMs: Number.isFinite(Number(data.timeSpentMs))
        ? Math.max(0, Number(data.timeSpentMs))
        : 0,
      formContext: data.formContext || {},
      fieldInteractions: Array.isArray(data.fieldInteractions)
        ? data.fieldInteractions.slice(0, 100)
        : [],
    };

    // Prepare funnel data updates if this is an order form page
    const stepName = page.startsWith("/order/")
      ? page.split("/").pop() || ""
      : null;

    // Check if this fingerprint already exists
    const existingThumbprint = await Thumbprint.findOne({
      fingerprintHash: fingerprintHash,
    });

    if (existingThumbprint) {
      // Use atomic findOneAndUpdate for existing records
      await Thumbprint.findOneAndUpdate(
        { fingerprintHash: fingerprintHash },
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
              ...(stepName === "review" &&
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
          // Push to arrays, keeping only the most recent visits so one
          // visitor's document cannot grow without bound.
          $push: {
            visits: { $each: [newVisit], $slice: -MAX_RETAINED_VISITS },
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
        fingerprintHash: fingerprintHash,
      });
    } else {
      // Use findOneAndUpdate with upsert for new records
      // This handles the case where the document might have been created
      // between our check and insert
      await Thumbprint.findOneAndUpdate(
        { fingerprintHash: fingerprintHash },
        {
          $setOnInsert: {
            fingerprintHash: fingerprintHash,
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
            visits: { $each: [newVisit], $slice: -MAX_RETAINED_VISITS },
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
        fingerprintHash: fingerprintHash,
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

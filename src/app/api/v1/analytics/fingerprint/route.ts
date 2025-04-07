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
    if (!data.fingerprintHash || !data.components) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    // Get user agent from headers
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || data.userAgent || '';
    
    // Determine device type based on user agent
    let deviceType: "desktop" | "tablet" | "mobile" | "other" = "other";
    if (/mobile/i.test(userAgent)) {
      deviceType = "mobile";
    } else if (/tablet/i.test(userAgent)) {
      deviceType = "tablet";
    } else if (/windows|macintosh|linux/i.test(userAgent)) {
      deviceType = "desktop";
    }
    
    // Check if this fingerprint already exists
    const existingThumbprint = await Thumbprint.findOne({ 
      fingerprintHash: data.fingerprintHash 
    });
    
    if (existingThumbprint) {
      // Update existing record
      existingThumbprint.lastSeen = new Date();
      existingThumbprint.visitCount += 1;
      
      // Add new visit
      existingThumbprint.visits.push({
        timestamp: new Date(),
        page: data.page || "/",
        referrer: data.referrer || null,
      });
      
      // Update user agent if provided
      if (userAgent) {
        existingThumbprint.userAgent = userAgent;
      }
      
      // Update device info if provided
      if (deviceType) {
        existingThumbprint.device = {
          ...existingThumbprint.device,
          type: deviceType,
          ...data.device
        };
      }
      
      await existingThumbprint.save();
      
      return NextResponse.json({ 
        success: true, 
        isNewVisitor: false,
        fingerprintHash: data.fingerprintHash
      });
    } else {
      // Create new record
      const newThumbprint = new Thumbprint({
        fingerprintHash: data.fingerprintHash,
        components: data.components,
        userAgent: userAgent,
        device: {
          type: deviceType,
          ...data.device
        },
        visits: [{
          timestamp: new Date(),
          page: data.page || "/",
          referrer: data.referrer || null
        }]
      });
      
      await newThumbprint.save();
      
      return NextResponse.json({ 
        success: true, 
        isNewVisitor: true,
        fingerprintHash: data.fingerprintHash
      });
    }
  } catch (error) {
    console.error("Error processing fingerprint:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process fingerprint" },
      { status: 500 }
    );
  }
}

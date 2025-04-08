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
      
      // Add new visit with form context and time spent if available
      existingThumbprint.visits.push({
        timestamp: new Date(),
        page: data.page || "/",
        referrer: data.referrer || null,
        timeSpentMs: data.timeSpentMs || 0,
        formContext: data.formContext || {},
        fieldInteractions: data.fieldInteractions || []
      });
      
      // Update funnel data if this is an order form page
      if (data.page && data.page.startsWith('/order/')) {
        const stepName = data.page.split('/').pop() || '';
        
        // Initialize funnelData if it doesn't exist
        if (!existingThumbprint.funnelData) {
          existingThumbprint.funnelData = {
            entryStep: stepName,
            completedSteps: [],
            exitStep: stepName
          };
        }
        
        // Update funnel data
        if (existingThumbprint.funnelData) {
          // Add to completed steps if not already there
          if (!existingThumbprint.funnelData.completedSteps?.includes(stepName)) {
            existingThumbprint.funnelData.completedSteps = [
              ...(existingThumbprint.funnelData.completedSteps || []),
              stepName
            ];
          }
          
          // Update exit step
          existingThumbprint.funnelData.exitStep = stepName;
          
          // If this is the payment step and we have all steps, mark as converted
          if (stepName === 'payment' && 
              existingThumbprint.funnelData.completedSteps?.length === 5) {
            existingThumbprint.conversion = {
              ...existingThumbprint.conversion,
              hasConverted: true,
              conversionDate: new Date(),
              conversionType: 'order_completed'
            };
          }
        }
      }
      
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
          referrer: data.referrer || null,
          timeSpentMs: data.timeSpentMs || 0,
          formContext: data.formContext || {},
          fieldInteractions: data.fieldInteractions || []
        }],
        // Initialize user segmentation
        userSegmentation: {
          userType: 'new',
          deviceCategory: deviceType,
          acquisitionSource: data.referrer ? 'referral' : 'direct'
        },
        // Initialize funnel data if this is an order form page
        ...(data.page && data.page.startsWith('/order/') ? {
          funnelData: {
            entryStep: data.page.split('/').pop() || '',
            completedSteps: [data.page.split('/').pop() || ''],
            exitStep: data.page.split('/').pop() || ''
          }
        } : {})
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

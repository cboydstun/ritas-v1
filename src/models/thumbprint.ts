import mongoose, { Schema, Document } from "mongoose";

// Define a type for browser components
export interface BrowserComponent {
  userAgent?: string;
  language?: string;
  platform?: string;
  screenWidth?: number;
  screenHeight?: number;
  colorDepth?: number;
  timezone?: string;
  sessionStorage?: boolean;
  localStorage?: boolean;
  indexedDb?: boolean;
  cookiesEnabled?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface IThumbprint extends Document {
  fingerprintHash: string;
  components: Record<string, BrowserComponent | string | number | boolean>;
  userAgent: string;
  device: {
    type: "desktop" | "tablet" | "mobile" | "other";
    brand?: string;
    model?: string;
  };
  location?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
  };
  visits: Array<{
    timestamp: Date;
    page: string;
    duration?: number;
    timeSpentMs?: number; // Track time spent on each page/step
    referrer?: string;
    exitPage?: string;
    formContext?: Record<string, object>;
    fieldInteractions?: Array<{
      fieldName: string;
      interactionCount: number;
      timeSpentMs: number;
      validationErrors: string[];
    }>;
    interactions?: {
      clicks?: number;
      scrollDepth?: number;
      formInteractions?: boolean;
    };
  }>;
  firstSeen: Date;
  lastSeen: Date;
  visitCount: number;
  conversion?: {
    hasConverted: boolean;
    conversionDate?: Date;
    conversionValue?: number;
    conversionType?: string;
  };
  segments?: string[];
  userSegmentation?: {
    acquisitionSource?: string;
    userType?: 'new' | 'returning' | 'converted';
    deviceCategory?: string;
    geographicRegion?: string;
    behaviors?: string[];
  };
  funnelData?: {
    entryStep?: string;
    exitStep?: string;
    completedSteps?: string[];
    abandonedStep?: string;
    conversionPath?: string;
  };
}

const ThumbprintSchema = new Schema<IThumbprint>({
  fingerprintHash: {
    type: String,
    required: true,
    index: true
  },
  components: {
    type: Object,
    required: true,
    default: {} // Add a default value
  },
  userAgent: {
    type: String,
    index: true
  },
  device: {
    type: {
      type: String,
      enum: ['desktop', 'tablet', 'mobile', 'other'],
      index: true
    },
    brand: String,
    model: String
  },
  location: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  visits: [{
    timestamp: Date,
    page: String,
    duration: Number,
    timeSpentMs: Number,
    referrer: String,
    exitPage: String,
    formContext: {
      type: Object,
      default: {}
    },
    fieldInteractions: {
      type: [{
        fieldName: String,
        interactionCount: Number,
        timeSpentMs: Number,
        validationErrors: [String]
      }],
      default: []
    },
    interactions: {
      clicks: Number,
      scrollDepth: Number,
      formInteractions: Boolean
    }
  }],
  firstSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  visitCount: {
    type: Number,
    default: 1,
    index: true
  },
  conversion: {
    hasConverted: {
      type: Boolean,
      default: false,
      index: true
    },
    conversionDate: Date,
    conversionValue: Number,
    conversionType: String
  },
  segments: {
    type: [String],
    index: true
  },
  userSegmentation: {
    type: {
      acquisitionSource: String,
      userType: {
        type: String,
        enum: ['new', 'returning', 'converted'],
        default: 'new'
      },
      deviceCategory: String,
      geographicRegion: String,
      behaviors: [String]
    },
    default: {}
  },
  funnelData: {
    type: {
      entryStep: String,
      exitStep: String,
      completedSteps: [String],
      abandonedStep: String,
      conversionPath: String
    },
    default: {}
  }
});

// Only create the model if it hasn't been created already
export const Thumbprint = mongoose.models.Thumbprint || 
  mongoose.model<IThumbprint>("Thumbprint", ThumbprintSchema);

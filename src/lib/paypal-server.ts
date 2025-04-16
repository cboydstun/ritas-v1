// Server-side PayPal initialization with development mode workaround
export const initializePayPalSDK = async () => {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error(
      `PayPal credentials not configured: ${
        !clientId ? "Missing client ID" : "Missing secret"
      }`,
    );
  }

  // Import PayPal SDK dynamically to ensure proper loading
  const paypalSdk = await import("@paypal/checkout-server-sdk");
  
  try {
    // Use a type assertion to access the SDK structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkModule = paypalSdk as any;
    
    // Log the SDK structure for debugging
    console.log("PayPal SDK keys:", Object.keys(sdkModule));
    if (sdkModule.default) {
      console.log("PayPal SDK default keys:", Object.keys(sdkModule.default));
      if (sdkModule.default.core) {
        console.log("PayPal SDK default.core keys:", Object.keys(sdkModule.default.core));
      }
    }
    
    // Determine which environment to use based on NODE_ENV
    const isProd = process.env.NODE_ENV === "production";
    
    // Create a custom client wrapper that handles development mode issues
    // This is a workaround for the authentication issues in development mode
    const customClient = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (request: any) => {
        try {
          // In development mode, we'll use a custom implementation
          if (!isProd) {
            console.log("Using development mode workaround for PayPal client");
            
            // Create the appropriate request based on the request type
            let url = "https://api-m.sandbox.paypal.com";
            const method = "POST";
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
              "Authorization": `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let data: any = {};
            
            // Determine the request type and set up the appropriate endpoint and data
            console.log(`Processing request with path: ${request.path} and verb: ${request.verb}`);
            
            // First check if it's a capture request (more specific)
            if (request.path.includes("/capture") && request.verb === "POST") {
              // This is a capture request
              // Extract the order ID from the path
              const pathParts = request.path.split("/");
              const orderId = pathParts[pathParts.length - 2]; // Get the ID before "/capture"
              
              url += `/v2/checkout/orders/${orderId}/capture`;
              
              // For capture requests, PayPal API expects an empty body or minimal data
              // Using an empty body as recommended in PayPal documentation for capture requests
              data = {};
              
              // Add debug logging
              console.log(`Sending capture request for order ${orderId} to ${url}`);
            } 
            // Then check if it's a regular order request (less specific)
            else if (request.path === "/v2/checkout/orders" || request.path === "/v2/checkout/orders/") {
              url += "/v2/checkout/orders";
              data = request.body;
              
              console.log(`Sending create order request to ${url}`);
            } 
            else {
              throw new Error(`Unsupported request path: ${request.path}`);
            }
            
            // Log the request details for debugging
            console.log(`PayPal API Request:
              URL: ${url}
              Method: ${method}
              Headers: ${JSON.stringify(headers, null, 2)}
              Body: ${data ? JSON.stringify(data, null, 2) : 'undefined'}
            `);
            
            // Make the request using fetch
            const response = await fetch(url, {
              method,
              headers,
              body: data ? JSON.stringify(data) : undefined,
            });
            
            // Log response status
            console.log(`PayPal API Response Status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
              const errorData = await response.json();
              console.error(`PayPal API Error Response: ${JSON.stringify(errorData, null, 2)}`);
              throw new Error(`PayPal API error: ${JSON.stringify(errorData)}`);
            }
            
            const responseData = await response.json();
            
            // Log successful response data (without sensitive info)
            console.log(`PayPal API Success Response: ${JSON.stringify({
              id: responseData.id,
              status: responseData.status,
              links: responseData.links,
            }, null, 2)}`);
            
            // Return a response object that matches the structure expected by the calling code
            return {
              result: responseData,
              statusCode: response.status,
            };
          }
          
          // For production, use the standard SDK client
          // Try different possible paths to access Environment and PayPalHttpClient
          let client;
          
          if (sdkModule.default && sdkModule.default.core) {
            // Access through default export
            const Environment = isProd 
              ? sdkModule.default.core.LiveEnvironment 
              : sdkModule.default.core.SandboxEnvironment;
            
            const environment = new Environment(clientId, secret);
            client = new sdkModule.default.core.PayPalHttpClient(environment);
          } else if (sdkModule.core) {
            // Direct access if available
            const Environment = isProd 
              ? sdkModule.core.LiveEnvironment 
              : sdkModule.core.SandboxEnvironment;
            
            const environment = new Environment(clientId, secret);
            client = new sdkModule.core.PayPalHttpClient(environment);
          } else if (sdkModule.LiveEnvironment && sdkModule.SandboxEnvironment && sdkModule.PayPalHttpClient) {
            // Flat structure
            const Environment = isProd 
              ? sdkModule.LiveEnvironment 
              : sdkModule.SandboxEnvironment;
            
            const environment = new Environment(clientId, secret);
            client = new sdkModule.PayPalHttpClient(environment);
          } else {
            // If none of the above structures work, throw a descriptive error
            throw new Error("Could not find required PayPal SDK components");
          }
          
          return client.execute(request);
        } catch (error) {
          console.error("Error executing PayPal request:", error);
          throw error;
        }
      }
    };
    
    return customClient;
  } catch (error) {
    console.error("Error initializing PayPal SDK:", error);
    throw new Error(`Failed to initialize PayPal SDK: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Type guard for PayPal environment check
export const isValidPayPalEnv = (): boolean => {
  const requiredEnvVars = [
    "NEXT_PUBLIC_PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar],
  );

  if (missingEnvVars.length > 0) {
    console.error(
      "Missing required PayPal environment variables:",
      missingEnvVars,
    );
    return false;
  }

  return true;
};

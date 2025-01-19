import paypal from "@paypal/checkout-server-sdk";

// Server-side PayPal initialization
export const initializePayPalSDK = async () => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !secret) {
        throw new Error(
            `PayPal credentials not configured: ${!clientId ? "Missing client ID" : "Missing secret"
            }`
        );
    }

    // Import PayPal SDK dynamically to ensure proper loading
    const sdk = await import("@paypal/checkout-server-sdk");

    // Create sandbox environment
    let environment = new sdk.default.core.SandboxEnvironment(clientId, secret);
    let client = new sdk.default.core.PayPalHttpClient(environment);
    return client;
};

// Type guard for PayPal environment check
export const isValidPayPalEnv = (): boolean => {
    const requiredEnvVars = [
        "NEXT_PUBLIC_PAYPAL_CLIENT_ID",
        "PAYPAL_CLIENT_SECRET",
    ];

    const missingEnvVars = requiredEnvVars.filter(
        (envVar) => !process.env[envVar]
    );

    if (missingEnvVars.length > 0) {
        console.error(
            "Missing required PayPal environment variables:",
            missingEnvVars
        );
        return false;
    }

    return true;
};

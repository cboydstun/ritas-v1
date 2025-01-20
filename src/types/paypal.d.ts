declare module "@paypal/checkout-server-sdk" {
  interface PayPalOrderResponse {
    result: {
      id: string;
      status: string;
      purchase_units: Array<{
        payments?: {
          captures?: Array<{
            id: string;
            status: string;
          }>;
        };
      }>;
    };
  }

  export class PayPalHttpClient {
    constructor(environment: SandboxEnvironment | LiveEnvironment);
    execute(request: OrdersCreateRequest): Promise<PayPalOrderResponse>;
    execute(request: OrdersCaptureRequest): Promise<PayPalOrderResponse>;
  }

  export class SandboxEnvironment {
    constructor(clientId: string, clientSecret: string);
    readonly clientId: string;
    readonly clientSecret: string;
  }

  export class LiveEnvironment {
    constructor(clientId: string, clientSecret: string);
    readonly clientId: string;
    readonly clientSecret: string;
  }

  export class OrdersCreateRequest {
    prefer(prefer: string): void;
    requestBody(body: {
      intent: string;
      purchase_units: Array<{
        amount: {
          currency_code: string;
          value: string;
          breakdown?: {
            item_total: {
              currency_code: string;
              value: string;
            };
          };
        };
        items?: Array<{
          name: string;
          quantity: string;
          unit_amount: {
            currency_code: string;
            value: string;
          };
        }>;
      }>;
    }): void;
  }

  export class OrdersCaptureRequest {
    constructor(orderId: string);
  }
}

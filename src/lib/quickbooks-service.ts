import QuickBooks from "node-quickbooks";
import { QuickBooksAuth } from "./quickbooks-auth";
import { OrderFormData } from "@/components/order/types";
import { Rental } from "@/models/rental";

// Define types for QuickBooks entities
interface QBCustomer {
  Id?: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: {
    Line1: string;
    City: string;
    CountrySubDivisionCode: string;
    PostalCode: string;
  };
  [key: string]: unknown;
}

interface QBInvoice {
  Id?: string;
  DocNumber?: string;
  CustomerRef: { value: string };
  Line: Array<{
    DetailType: string;
    SalesItemLineDetail?: {
      ItemRef: { value: string };
      Qty?: number;
      UnitPrice?: number;
    };
    Amount: number;
    Description?: string;
  }>;
  TxnDate?: string;
  DueDate?: string;
  [key: string]: unknown;
}

interface QBItem {
  Id?: string;
  Name: string;
  Description?: string;
  UnitPrice?: number;
  Type: string;
  IncomeAccountRef: { value: string };
  [key: string]: unknown;
}

// QuickBooks Service class
export class QuickBooksService {
  private qb: QuickBooks;
  private static instance: QuickBooksService;
  private realmId: string = "";

  private constructor() {
    // This will be initialized when needed
    this.qb = {} as QuickBooks;
  }

  // Singleton pattern
  public static getInstance(): QuickBooksService {
    if (!QuickBooksService.instance) {
      QuickBooksService.instance = new QuickBooksService();
    }
    return QuickBooksService.instance;
  }

  // Initialize QuickBooks client with valid tokens
  public async initialize(): Promise<void> {
    try {
      const qbAuth = QuickBooksAuth.getInstance();
      
      try {
        const tokens = await qbAuth.getValidTokens();

        // Get realmId from environment or database
        this.realmId = process.env.QB_REALM_ID || "";

        if (!this.realmId) {
          throw new Error("QuickBooks Realm ID not found");
        }

        // Initialize QuickBooks client
        this.qb = new QuickBooks(
          process.env.QB_CLIENT_ID || "",
          process.env.QB_CLIENT_SECRET || "",
          tokens.access_token,
          false, // don't use sandbox if in production
          this.realmId,
          process.env.QB_ENVIRONMENT === "sandbox", // use sandbox in development
          true, // debug
          null, // oauthversion
          "2.0", // API version
          tokens.refresh_token,
        );
      } catch (tokenError) {
        console.error("Error getting valid QuickBooks tokens:", tokenError);
        
        // Check if this is an authentication error
        const errorStr = String(tokenError);
        if (
          errorStr.includes("authenticate") || 
          errorStr.includes("expired") ||
          errorStr.includes("invalid_token") ||
          errorStr.includes("invalid_grant")
        ) {
          throw new Error(
            "QuickBooks authentication has expired. Please reconnect to QuickBooks in the admin panel."
          );
        }
        
        throw tokenError;
      }
    } catch (error) {
      console.error("Error initializing QuickBooks service:", error);
      throw error;
    }
  }

  // Find customer by email or create a new one
  public async findOrCreateCustomer(
    customerData: OrderFormData["customer"],
  ): Promise<string> {
    try {
      await this.initialize();

      // First try to find customer by email
      return new Promise((resolve, reject) => {
        console.log(`Searching for customer with email: ${customerData.email}`);
        
        this.qb.findCustomers(
          [{ field: "PrimaryEmailAddr", value: customerData.email }],
          (err, customers) => {
            if (err) {
              console.error("Error finding customer by email:", err);
              reject(err);
              return;
            }

            // Add detailed logging to see what's being returned
            console.log("Customer search results:", JSON.stringify(customers, null, 2));

            // More robust check for existing customers
            if (customers && 
                Array.isArray(customers) && 
                customers.length > 0 && 
                customers[0] && 
                customers[0].Id) {
              // Customer found, return ID
              console.log(`Found existing customer with ID: ${customers[0].Id}`);
              resolve(customers[0].Id as string);
              return;
            }
            
            // Check if the response has a different structure (QuickBooks API can be inconsistent)
            if (customers && 
                typeof customers === 'object' && 
                'QueryResponse' in customers) {
              // Use type assertion to access QueryResponse
              const queryResponse = (customers as any).QueryResponse;
              if (queryResponse && 
                  queryResponse.Customer && 
                  Array.isArray(queryResponse.Customer) && 
                  queryResponse.Customer.length > 0 &&
                  queryResponse.Customer[0].Id) {
                const customerId = queryResponse.Customer[0].Id;
                console.log(`Found existing customer in QueryResponse with ID: ${customerId}`);
                resolve(customerId as string);
                return;
              }
            }

            console.log("No existing customer found, creating new one");
            
            // Customer not found, create new one
            const newCustomer: QBCustomer = {
              DisplayName: customerData.name,
              PrimaryEmailAddr: { Address: customerData.email },
              PrimaryPhone: { FreeFormNumber: customerData.phone },
              BillAddr: {
                Line1: customerData.address.street,
                City: customerData.address.city,
                CountrySubDivisionCode: customerData.address.state,
                PostalCode: customerData.address.zipCode,
              },
            };

            this.qb.createCustomer(newCustomer, (err, customer) => {
              if (err) {
                console.error("Error creating customer:", err);
                
                // Check if this is a duplicate name error
                // Use type assertion for QuickBooks error structure
                const qbError = err as any;
                if (qbError.Fault && 
                    qbError.Fault.Error && 
                    Array.isArray(qbError.Fault.Error) &&
                    qbError.Fault.Error[0] && 
                    qbError.Fault.Error[0].code === "6240") {
                  console.log("Duplicate customer error detected, trying to find by name instead");
                  
                  // Try to find the customer by name as a fallback
                  this.qb.findCustomers(
                    [{ field: "DisplayName", value: customerData.name }],
                    (nameErr, nameCustomers) => {
                      if (nameErr) {
                        console.error("Error finding customer by name:", nameErr);
                        reject(err); // Still reject with the original error
                        return;
                      }
                      
                      if (!nameCustomers || 
                          !Array.isArray(nameCustomers) || 
                          nameCustomers.length === 0 || 
                          !nameCustomers[0] || 
                          !nameCustomers[0].Id) {
                        console.error("Could not find customer by name either");
                        reject(err); // Still reject with the original error
                        return;
                      }
                      
                      console.log(`Found customer by name with ID: ${nameCustomers[0].Id}`);
                      resolve(nameCustomers[0].Id as string);
                    }
                  );
                  return;
                }
                
                reject(err);
                return;
              }

              if (!customer || !customer.Id) {
                reject(
                  new Error("Failed to create customer: No ID returned"),
                );
                return;
              }

              console.log(`Created new customer with ID: ${customer.Id}`);
              resolve(customer.Id as string);
            });
          },
        );
      });
    } catch (error) {
      console.error("Error finding or creating customer:", error);
      throw error;
    }
  }

  // Find or create an item in QuickBooks
  public async findOrCreateItem(
    name: string,
    description: string,
    unitPrice: number,
  ): Promise<string> {
    try {
      await this.initialize();

      return new Promise((resolve, reject) => {
        // First try to find the item by name
        this.qb.findItems([{ field: "Name", value: name }], (err, items) => {
          if (err) {
            reject(err);
            return;
          }

          if (items && items.length > 0) {
            // Item found, return ID
            resolve(items[0].Id as string);
          } else {
            // Item not found, create new one
            // First, we need to get the PayPal Bank account
            this.qb.findAccounts(
              [{ field: "Name", value: "PayPal Bank" }],
              (err, accounts) => {
                if (err) {
                  console.error("Error finding PayPal Bank account:", err);
                  reject(err);
                  return;
                }

                console.log("PayPal Bank account search result:", JSON.stringify(accounts, null, 2));

                // Check for different response formats from QuickBooks API
                let paypalBankAccount = null;

                // Check if accounts is an array with elements
                if (Array.isArray(accounts) && accounts.length > 0 && accounts[0] && accounts[0].Id) {
                  paypalBankAccount = accounts[0];
                } 
                // Check if accounts is in QueryResponse format with Account array
                else if (accounts && 
                         typeof accounts === 'object' && 
                         'QueryResponse' in accounts && 
                         (accounts as any).QueryResponse.Account && 
                         Array.isArray((accounts as any).QueryResponse.Account) && 
                         (accounts as any).QueryResponse.Account.length > 0) {
                  paypalBankAccount = (accounts as any).QueryResponse.Account[0];
                }

                // If PayPal Bank account not found, look for any Income account
                if (!paypalBankAccount) {
                  console.log("PayPal Bank account not found, looking for any Income account as fallback");
                  
                  // Try to find any Income account as fallback
                  this.qb.findAccounts(
                    [{ field: "AccountType", value: "Income" }],
                    (err, incomeAccounts) => {
                      if (err) {
                        console.error("Error finding Income accounts:", err);
                        reject(err);
                        return;
                      }

                      console.log("Income accounts search result:", JSON.stringify(incomeAccounts, null, 2));

                      // Check for different response formats for income accounts
                      let incomeAccount = null;

                      // Check if incomeAccounts is an array with elements
                      if (Array.isArray(incomeAccounts) && incomeAccounts.length > 0 && incomeAccounts[0] && incomeAccounts[0].Id) {
                        incomeAccount = incomeAccounts[0];
                      } 
                      // Check if incomeAccounts is in QueryResponse format with Account array
                      else if (incomeAccounts && 
                               typeof incomeAccounts === 'object' && 
                               'QueryResponse' in incomeAccounts && 
                               (incomeAccounts as any).QueryResponse.Account && 
                               Array.isArray((incomeAccounts as any).QueryResponse.Account) && 
                               (incomeAccounts as any).QueryResponse.Account.length > 0) {
                        incomeAccount = (incomeAccounts as any).QueryResponse.Account[0];
                      }

                      if (!incomeAccount) {
                        console.error("No Income accounts found in QuickBooks");
                        reject(new Error("No Income accounts found in QuickBooks. Please create a 'PayPal Bank' account or any Income account."));
                        return;
                      }

                      const fallbackAccountId = incomeAccount.Id;
                      console.log(`Using fallback Income account: ${fallbackAccountId}`);

                      const newItem: QBItem = {
                        Name: name,
                        Description: description,
                        Type: "Service",
                        UnitPrice: unitPrice,
                        IncomeAccountRef: { value: fallbackAccountId as string },
                      };

                      this.createItemWithAccount(newItem, resolve, reject);
                    }
                  );
                  return;
                }

                // Use the PayPal Bank account
                const paypalBankAccountId = paypalBankAccount.Id;
                console.log(`Using PayPal Bank account: ${paypalBankAccountId}`);

                const newItem: QBItem = {
                  Name: name,
                  Description: description,
                  Type: "Service",
                  UnitPrice: unitPrice,
                  IncomeAccountRef: { value: paypalBankAccountId as string },
                };

                this.createItemWithAccount(newItem, resolve, reject);
              }
            );
          }
        });
      });
    } catch (error) {
      console.error("Error finding or creating item:", error);
      throw error;
    }
  }

  // Helper method to create an item with the specified account
  private createItemWithAccount(
    newItem: QBItem,
    resolve: (value: string) => void,
    reject: (reason: Error) => void
  ): void {
    this.qb.createItem(newItem, (err, item) => {
      if (err) {
        console.error("Error creating item:", err);
        
        // Check if this is a duplicate name error
        const qbError = err as any;
        if (qbError.Fault && 
            qbError.Fault.Error && 
            Array.isArray(qbError.Fault.Error) &&
            qbError.Fault.Error[0] && 
            qbError.Fault.Error[0].code === "6240") {
          console.log("Duplicate item error detected");
          
          // Try to extract the item ID from the error message
          const errorDetail = qbError.Fault.Error[0].Detail;
          const idMatch = errorDetail && errorDetail.match(/Id=(\d+)/);
          
          if (idMatch && idMatch[1]) {
            const existingItemId = idMatch[1];
            console.log(`Found existing item ID from error: ${existingItemId}`);
            resolve(existingItemId);
            return;
          }
          
          // If we couldn't extract the ID, try to find the item by name
          console.log(`Trying to find item by name: ${newItem.Name}`);
          this.qb.findItems(
            [{ field: "Name", value: newItem.Name }],
            (nameErr, nameItems) => {
              if (nameErr) {
                console.error("Error finding item by name:", nameErr);
                reject(err); // Still reject with the original error
                return;
              }
              
              if (!nameItems || 
                  !Array.isArray(nameItems) || 
                  nameItems.length === 0 || 
                  !nameItems[0] || 
                  !nameItems[0].Id) {
                console.error("Could not find item by name either");
                reject(err); // Still reject with the original error
                return;
              }
              
              console.log(`Found item by name with ID: ${nameItems[0].Id}`);
              resolve(nameItems[0].Id as string);
            }
          );
          return;
        }
        
        reject(err);
        return;
      }

      if (!item || !item.Id) {
        reject(new Error("Failed to create item: No ID returned"));
        return;
      }

      console.log(`Created new item with ID: ${item.Id}`);
      resolve(item.Id as string);
    });
  }

  // Create an invoice in QuickBooks
  public async createInvoice(rental: {
    customer: OrderFormData["customer"];
    machineType: string;
    capacity: number;
    price: number;
    selectedMixers?: string[];
    selectedExtras?: Array<{ name: string; price?: number; quantity?: number }>;
  }): Promise<QBInvoice> {
    try {
      await this.initialize();

      // Find or create customer
      const customerId = await this.findOrCreateCustomer(rental.customer);

      // Create line items
      const lineItems = [];

      // Add machine rental line item
      const machineItemId = await this.findOrCreateItem(
        `${rental.machineType} Slushy Machine Rental`,
        `${rental.machineType} Slushy Machine Rental (${rental.capacity}L)`,
        rental.price,
      );

      lineItems.push({
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: machineItemId },
          Qty: 1,
          UnitPrice: rental.price,
        },
        Amount: rental.price,
        Description: `${rental.machineType} Slushy Machine Rental (${rental.capacity}L)`,
      });

      // Add mixer line items if any
      if (rental.selectedMixers && rental.selectedMixers.length > 0) {
        for (const mixer of rental.selectedMixers) {
          const mixerItemId = await this.findOrCreateItem(
            `${mixer} Mixer`,
            `${mixer} Mixer for Slushy Machine`,
            0, // Included in machine rental price
          );

          lineItems.push({
            DetailType: "SalesItemLineDetail",
            SalesItemLineDetail: {
              ItemRef: { value: mixerItemId },
              Qty: 1,
              UnitPrice: 0,
            },
            Amount: 0,
            Description: `${mixer} Mixer`,
          });
        }
      }

      // Add extras line items if any
      if (rental.selectedExtras && rental.selectedExtras.length > 0) {
        for (const extra of rental.selectedExtras) {
          const extraItemId = await this.findOrCreateItem(
            extra.name,
            `${extra.name} - Party Extra`,
            extra.price || 0,
          );

          const quantity = extra.quantity || 1;
          const amount = (extra.price || 0) * quantity;

          lineItems.push({
            DetailType: "SalesItemLineDetail",
            SalesItemLineDetail: {
              ItemRef: { value: extraItemId },
              Qty: quantity,
              UnitPrice: extra.price || 0,
            },
            Amount: amount,
            Description: `${extra.name}${quantity > 1 ? ` (${quantity}x)` : ""}`,
          });
        }
      }

      // Create the invoice
      const invoice: QBInvoice = {
        CustomerRef: { value: customerId },
        Line: lineItems,
        TxnDate: new Date().toISOString().split("T")[0], // Today's date
        DueDate: new Date().toISOString().split("T")[0], // Due today since it's already paid
        ShipFromAddr: null, // Explicitly remove shipping address
      };

      return new Promise((resolve, reject) => {
        this.qb.createInvoice(invoice, (err, createdInvoice) => {
          if (err) {
            reject(err);
            return;
          }

          if (!createdInvoice) {
            reject(new Error("Failed to create invoice: No invoice returned"));
            return;
          }
          resolve({
            Id: createdInvoice.Id,
            DocNumber: createdInvoice.DocNumber,
            CustomerRef: createdInvoice.CustomerRef,
            Line: createdInvoice.Line,
            TxnDate: createdInvoice.TxnDate,
            DueDate: createdInvoice.DueDate,
          } as QBInvoice);
        });
      });
    } catch (error) {
      console.error("Error creating invoice:", error);
      throw error;
    }
  }
}

// Helper function to generate QuickBooks invoice from rental data
export async function generateQuickBooksInvoice(rental: {
  _id?: string; // MongoDB ID for logging errors
  customer: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  machineType: string;
  capacity: number;
  price: number;
  selectedMixers?: string[];
  selectedExtras?: Array<{ name: string; price?: number; quantity?: number }>;
}): Promise<QBInvoice> {
  try {
    console.log(`Generating QuickBooks invoice for rental: ${rental._id}`);
    const qbService = QuickBooksService.getInstance();
    const invoice = await qbService.createInvoice(rental);
    
    // If we have a rental ID, update the rental with the invoice ID
    if (rental._id) {
      try {
        await Rental.findByIdAndUpdate(rental._id, {
          $set: {
            "quickbooks.syncStatus": "success",
            "quickbooks.lastSyncAttempt": new Date(),
            "quickbooks.invoiceId": invoice.Id,
            "quickbooks.invoiceNumber": invoice.DocNumber,
          },
        });
      } catch (dbError) {
        console.error("Error updating rental with QuickBooks invoice ID:", dbError);
        // Continue even if the update fails
      }
    }
    
    return invoice;
  } catch (error) {
    console.error("Error generating QuickBooks invoice:", error);
    
    // Log the error to the database if we have a rental ID
    if (rental._id) {
      await logQuickBooksError(rental._id.toString(), error);
    }
    
    // Check if this is an authentication error
    const errorStr = String(error);
    if (
      errorStr.includes("authenticate") || 
      errorStr.includes("expired") ||
      errorStr.includes("invalid_token") ||
      errorStr.includes("invalid_grant") ||
      errorStr.includes("Token expired")
    ) {
      throw new Error(
        "QuickBooks authentication has expired. Please reconnect to QuickBooks in the admin panel."
      );
    }
    
    throw error;
  }
}

// Helper function to log QuickBooks errors for later retry
export async function logQuickBooksError(
  rentalId: string,
  error: unknown,
): Promise<void> {
  try {
    // Get the current rental to access retry count
    const rental = await Rental.findById(rentalId);
    if (!rental) {
      console.error(`Rental not found for ID: ${rentalId}`);
      return;
    }
    
    // Get current retry count or default to 0
    const retryCount = rental.quickbooks?.retryCount || 0;
    
    // Calculate next retry time with exponential backoff
    // Base delay is 5 minutes, doubles each retry up to a max of 24 hours
    const baseDelayMinutes = 5;
    const maxDelayHours = 24;
    
    // Calculate delay in milliseconds with exponential backoff: baseDelay * 2^retryCount
    const delayMinutes = Math.min(
      baseDelayMinutes * Math.pow(2, retryCount),
      maxDelayHours * 60
    );
    
    const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    // Determine sync status based on error type
    const errorStr = String(error);
    const syncStatus = errorStr.includes("authenticate") || 
                       errorStr.includes("expired") ||
                       errorStr.includes("invalid_token") ||
                       errorStr.includes("invalid_grant") ||
                       errorStr.includes("Token expired")
                       ? "auth_error"
                       : "failed";
    
    // Update the rental with error details and retry information
    await Rental.findByIdAndUpdate(rentalId, {
      $set: {
        "quickbooks.syncStatus": syncStatus,
        "quickbooks.lastSyncAttempt": new Date(),
        "quickbooks.syncError":
          error instanceof Error ? error.message : JSON.stringify(error),
        "quickbooks.retryCount": retryCount + 1,
        "quickbooks.nextRetryAt": nextRetryAt,
      },
    });
    
    console.log(`QuickBooks error logged for rental ${rentalId}. Next retry scheduled at ${nextRetryAt.toISOString()}`);
  } catch (dbError) {
    console.error("Error logging QuickBooks error:", dbError);
  }
}

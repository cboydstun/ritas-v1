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
        this.qb.findCustomers(
          [{ field: "PrimaryEmailAddr", value: customerData.email }],
          (err, customers) => {
            if (err) {
              reject(err);
              return;
            }

            if (customers && customers.length > 0) {
              // Customer found, return ID
              resolve(customers[0].Id as string);
            } else {
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
                  reject(err);
                  return;
                }

                if (!customer || !customer.Id) {
                  reject(
                    new Error("Failed to create customer: No ID returned"),
                  );
                  return;
                }

                resolve(customer.Id as string);
              });
            }
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
            // First, we need to get the default income account
            this.qb.findAccounts(
              [{ field: "AccountType", value: "Income" }],
              (err, accounts) => {
                if (err) {
                  reject(err);
                  return;
                }

                if (!accounts || accounts.length === 0) {
                  reject(new Error("No income account found in QuickBooks"));
                  return;
                }

                const incomeAccountId = accounts[0].Id;

                const newItem: QBItem = {
                  Name: name,
                  Description: description,
                  Type: "Service",
                  UnitPrice: unitPrice,
                  IncomeAccountRef: { value: incomeAccountId as string },
                };

                this.qb.createItem(newItem, (err, item) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  if (!item || !item.Id) {
                    reject(new Error("Failed to create item: No ID returned"));
                    return;
                  }

                  resolve(item.Id as string);
                });
              },
            );
          }
        });
      });
    } catch (error) {
      console.error("Error finding or creating item:", error);
      throw error;
    }
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
    const qbService = QuickBooksService.getInstance();
    return await qbService.createInvoice(rental);
  } catch (error) {
    console.error("Error generating QuickBooks invoice:", error);
    throw error;
  }
}

// Helper function to log QuickBooks errors for later retry
export async function logQuickBooksError(
  rentalId: string,
  error: unknown,
): Promise<void> {
  try {
    await Rental.findByIdAndUpdate(rentalId, {
      $set: {
        "quickbooks.syncStatus": "failed",
        "quickbooks.lastSyncAttempt": new Date(),
        "quickbooks.syncError":
          error instanceof Error ? error.message : JSON.stringify(error),
      },
    });
  } catch (dbError) {
    console.error("Error logging QuickBooks error:", dbError);
  }
}

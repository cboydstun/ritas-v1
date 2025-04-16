declare module 'node-quickbooks' {
  interface QueryFilter {
    field: string;
    value: string | number | boolean;
    operator?: string;
  }

  interface Entity {
    Id?: string;
    [key: string]: any;
  }

  type CallbackFunction<T = any> = (err: any, entity?: T, response?: any) => void;

  class QuickBooks {
    constructor(
      consumerKey: string,
      consumerSecret: string,
      accessToken: string,
      accessTokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      oauthversion?: string | null,
      minorversion?: string,
      refreshToken?: string
    );

    // Customer methods
    findCustomers(
      criteria: QueryFilter[],
      callback: CallbackFunction<Entity[]>
    ): void;

    createCustomer(
      customer: Entity,
      callback: CallbackFunction<Entity>
    ): void;

    // Item methods
    findItems(
      criteria: QueryFilter[],
      callback: CallbackFunction<Entity[]>
    ): void;

    createItem(
      item: Entity,
      callback: CallbackFunction<Entity>
    ): void;

    // Account methods
    findAccounts(
      criteria: QueryFilter[],
      callback: CallbackFunction<Entity[]>
    ): void;

    // Invoice methods
    createInvoice(
      invoice: Entity,
      callback: CallbackFunction<Entity>
    ): void;

    // Other methods can be added as needed
  }

  export = QuickBooks;
}

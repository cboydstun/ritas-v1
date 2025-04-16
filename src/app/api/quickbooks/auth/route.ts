import { getAuthorizationUrlHandler } from "@/lib/quickbooks-auth";

export async function GET() {
  return getAuthorizationUrlHandler();
}

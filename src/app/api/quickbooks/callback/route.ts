import { handleCallbackHandler } from "@/lib/quickbooks-auth";

export async function GET() {
  return handleCallbackHandler();
}

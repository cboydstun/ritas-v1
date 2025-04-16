import { handleCallbackHandler } from "@/lib/quickbooks-auth";

export async function GET(request: Request) {
  return handleCallbackHandler(request);
}

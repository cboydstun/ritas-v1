import { disconnectHandler } from "@/lib/quickbooks-auth";

export async function POST() {
  return disconnectHandler();
}

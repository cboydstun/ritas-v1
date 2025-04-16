import { NextRequest } from 'next/server';
import { handleCallbackHandler } from '@/lib/quickbooks-auth';

export async function GET(request: NextRequest) {
  return handleCallbackHandler(request);
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrlHandler } from '@/lib/quickbooks-auth';

export async function GET(request: NextRequest) {
  return getAuthorizationUrlHandler();
}

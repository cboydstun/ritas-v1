import { NextRequest } from 'next/server';
import { disconnectHandler } from '@/lib/quickbooks-auth';

export async function POST(request: NextRequest) {
  return disconnectHandler();
}

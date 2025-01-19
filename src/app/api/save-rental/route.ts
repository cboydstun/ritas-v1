import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const client = await clientPromise;
        const db = client.db();

        const result = await db.collection('rentals').insertOne(body);

        return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
    } catch (error) {
        console.error('Error saving rental:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to save rental' },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json(
        { message: 'This endpoint only accepts POST requests' },
        { status: 405 }
    );
}

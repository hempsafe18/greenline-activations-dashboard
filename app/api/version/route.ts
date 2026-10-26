import { NextResponse } from 'next/server';

// Never cache: the whole point is to see the deployment that is live right now.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? '' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

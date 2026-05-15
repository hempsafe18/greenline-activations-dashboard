import { NextResponse } from 'next/server';

const LIST_ID = 57;

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ count: 0, debug: 'no_token' });

  try {
    // CRM Object Lists v3 — memberships endpoint returns total directly
    const res = await fetch(
      `https://api.hubapi.com/crm/v3/lists/${LIST_ID}/memberships?limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.ok) {
      const data = await res.json();
      if (typeof data.total === 'number') {
        return NextResponse.json({ count: data.total });
      }
    }

    // Fallback: CRM Lists v3 metadata
    const metaRes = await fetch(
      `https://api.hubapi.com/crm/v3/lists/${LIST_ID}?includeFilters=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (metaRes.ok) {
      const data = await metaRes.json();
      const count = data.list?.size ?? data.size;
      if (typeof count === 'number') return NextResponse.json({ count });
    }

    const debug = `memberships_${res.status}/meta_${metaRes.status}`;
    console.error('HubSpot CRM list fetch failed:', debug);
    return NextResponse.json({ count: 0, debug });

  } catch (error) {
    console.error('Ambassador API error:', error);
    return NextResponse.json({ count: 0, debug: 'exception' });
  }
}

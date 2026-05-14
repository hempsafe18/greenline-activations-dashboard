import { NextResponse } from 'next/server';

const LIST_ID = 60350386;

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ count: 0, debug: 'no_token' });

  try {
    // Try v3 Lists API first (requires crm.lists.read scope)
    const v3Res = await fetch(
      `https://api.hubapi.com/crm/v3/lists/${LIST_ID}?includeFilters=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (v3Res.ok) {
      const data = await v3Res.json();
      const count = data.list?.size ?? data.size;
      if (typeof count === 'number') return NextResponse.json({ count });
    }

    // Fall back to v1 Contacts Lists API (requires contacts scope)
    const v1Res = await fetch(
      `https://api.hubapi.com/contacts/v1/lists/${LIST_ID}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (v1Res.ok) {
      const data = await v1Res.json();
      const count = data.metaData?.size;
      if (typeof count === 'number') return NextResponse.json({ count });
    }

    const v1Err = v1Res.ok ? 'unexpected_shape' : `v1_${v1Res.status}`;
    const v3Err = v3Res.ok ? 'unexpected_shape' : `v3_${v3Res.status}`;
    console.error(`HubSpot ambassador fetch: ${v3Err} / ${v1Err}`);
    return NextResponse.json({ count: 0, debug: `${v3Err}/${v1Err}` });

  } catch (error) {
    console.error('Ambassador API error:', error);
    return NextResponse.json({ count: 0, debug: 'exception' });
  }
}

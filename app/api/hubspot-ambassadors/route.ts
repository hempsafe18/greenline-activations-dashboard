import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ count: 0, debug: 'no_token' });

  try {
    // Count contacts where ambassador_status property is set
    const res = await fetch(
      'https://api.hubapi.com/crm/v3/objects/contacts/search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: 'ambassador_status', operator: 'HAS_PROPERTY' }] }],
          limit: 1,
          properties: ['hs_object_id'],
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (typeof data.total === 'number') {
        return NextResponse.json({ count: data.total });
      }
    }

    console.error('HubSpot ambassador search failed:', res.status);
    return NextResponse.json({ count: 0, debug: `search_${res.status}` });

  } catch (error) {
    console.error('Ambassador API error:', error);
    return NextResponse.json({ count: 0, debug: 'exception' });
  }
}

import { NextResponse } from 'next/server';

const LIST_ID = 57;

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ count: 0, debug: 'no_token' });

  try {
    let count = 0;
    let hasMore = true;
    let vidOffset = 0;

    while (hasMore) {
      const res = await fetch(
        `https://api.hubapi.com/contacts/v1/lists/${LIST_ID}/contacts/all?count=100&property=vid&vidOffset=${vidOffset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        console.error('HubSpot list contacts fetch failed:', res.status, await res.text());
        break;
      }

      const data = await res.json();
      count += (data.contacts?.length ?? 0);
      hasMore = data['has-more'] ?? false;
      vidOffset = data['vid-offset'] ?? 0;
    }

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Ambassador API error:', error);
    return NextResponse.json({ count: 0, debug: 'exception' });
  }
}

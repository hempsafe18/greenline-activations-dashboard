import { NextResponse } from 'next/server';

const LIST_ID = 57;

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ count: 0, debug: 'no_token' });

  try {
    const response = await fetch(
      `https://api.hubapi.com/contacts/v1/lists/${LIST_ID}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('HubSpot list fetch failed:', err);
      return NextResponse.json({ count: 0, debug: `list_${response.status}` });
    }

    const data = await response.json();
    return NextResponse.json({ count: data.metaData?.size ?? 0 });
  } catch (error) {
    console.error('Ambassador API error:', error);
    return NextResponse.json({ count: 0, debug: 'exception' });
  }
}

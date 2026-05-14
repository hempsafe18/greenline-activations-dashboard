import { NextResponse } from 'next/server';

const AMBASSADOR_LIST_ID = 60350386;

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ count: 0 });

  try {
    const response = await fetch(
      `https://api.hubapi.com/contacts/v1/lists/${AMBASSADOR_LIST_ID}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) {
      console.error('HubSpot list fetch failed:', await response.text());
      return NextResponse.json({ count: 0 });
    }

    const data = await response.json();
    return NextResponse.json({ count: data.metaData?.size ?? 0 });
  } catch (error) {
    console.error('Ambassador API error:', error);
    return NextResponse.json({ count: 0 });
  }
}

import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ count: 0 });

  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [
            { propertyName: 'jobtitle', operator: 'EQ', value: 'Brand Ambassador' },
            { propertyName: 'category', operator: 'EQ', value: 'Ambassador' },
          ]
        }],
        properties: ['firstname', 'lastname'],
        limit: 1,
      }),
    });

    if (!response.ok) {
      console.error('HubSpot ambassador fetch failed:', await response.text());
      return NextResponse.json({ count: 0 });
    }

    const data = await response.json();
    return NextResponse.json({ count: data.total ?? 0 });
  } catch (error) {
    console.error('Ambassador API error:', error);
    return NextResponse.json({ count: 0 });
  }
}

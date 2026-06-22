import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-ondeck-from-hubspot`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Edge function returned ${res.status}`, detail: body },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true, result: body });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Network error' }, { status: 500 });
  }
}

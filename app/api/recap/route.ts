import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const { client, storeName, eventDate, submittedBy, sampled, sold, notes } = await req.json();

    if (!client || !storeName || !eventDate) {
      return NextResponse.json({ success: false, error: 'client, storeName, and eventDate are required' }, { status: 400 });
    }

    const statsLine = sampled
      ? ` Consumers sampled: ${sampled}${sold ? `, units sold: ${sold}` : ''}.`
      : '';
    const byLine = submittedBy ? ` Submitted by ${submittedBy}.` : '';

    const { error } = await supabase.from('client_notifications').insert({
      client_id: client,
      type: 'update',
      subject: `Recap Submitted: ${storeName} — ${eventDate}`,
      body: `A new activation recap has been submitted for ${storeName} on ${eventDate}.${statsLine}${byLine}${notes ? ` Notes: ${notes}` : ''} View it in your Activation Calendar.`,
      read: false,
      metadata: { storeName, eventDate, submittedBy, sampled, sold, notes },
    });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Recap notification error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

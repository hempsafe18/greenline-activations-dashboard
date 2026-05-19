import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const { client, storeName, eventDate, staffName, staffRole, notes } = await req.json();

    if (!client || !storeName || !eventDate) {
      return NextResponse.json({ success: false, error: 'client, storeName, and eventDate are required' }, { status: 400 });
    }

    const staffLabel = staffRole ? `${staffName} (${staffRole})` : staffName;
    const subject = `Staff Assigned: ${storeName} on ${eventDate}`;
    const body = staffName
      ? `${staffLabel} has been assigned to your activation at ${storeName} on ${eventDate}.${notes ? ` Notes: ${notes}` : ''}`
      : `Staff has been assigned to your activation at ${storeName} on ${eventDate}.${notes ? ` Notes: ${notes}` : ''}`;

    const { error } = await supabase.from('client_notifications').insert({
      client_id: client,
      type: 'update',
      subject,
      body,
      read: false,
      metadata: { storeName, eventDate, staffName, staffRole, notes },
    });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Staff assign error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '../../../lib/supabase';

const ADMIN_EMAILS = ["asmar@greenlineactivations.com", "sedell@greenlineactivations.com", "asmar.gary@gmail.com"];

const CLIENT_COMPANY: Record<string, string> = {
  AMIGOS:           'Amigos',
  '3CHI':           '3CHI',
  'MELLOW FELLOW':  'Mellow Fellow',
  GROW:             'Grow',
  GROOVEWAGON:      'Groovewagon',
  WILLIES_REMEDY:   "Willie's Remedy",
  CLAYBOURNE_CO:    'Claybourne Co.',
};

// Standard ambassador pay rate applied to events created from an approved request.
const STANDARD_PAY_RATE = 30;
const CLIENT_PAY_RATE: Record<string, number> = {
  WILLIES_REMEDY: 32,
  CLAYBOURNE_CO: 32,
};

// Best-effort city extraction for requests submitted without a market selected —
// the Events portal filters by city, so a null city silently hides the event.
// Handles "<street>, <city>, ST zip" and "<street city>, ST zip" (no dedicated
// city segment, e.g. a single-word city run together with the street).
function parseCityFromAddress(address: string | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  const stateZipIndex = parts.findIndex(p => /^[A-Z]{2}(\s+\d{5})?(\s|$)/.test(p));
  if (stateZipIndex <= 0) return null;

  const candidate = parts[stateZipIndex - 1];
  if (!candidate) return null;
  if (!/^\d/.test(candidate)) return candidate;

  const words = candidate.split(/\s+/);
  return words[words.length - 1] || null;
}

async function requireAdmin() {
  const user = await currentUser();
  const email = user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? '';
  if (!user || !ADMIN_EMAILS.includes(email)) return null;
  return user;
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('client_notifications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ requests: [], error: error.message });
  return NextResponse.json({ requests: data ?? [] });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ success: false }, { status: 401 });

  const { id, action } = await req.json();
  if (!id || !['approve', 'decline'].includes(action)) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }

  const { data: notif, error: fetchError } = await supabase
    .from('client_notifications')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !notif) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
  if (notif.status !== 'pending') return NextResponse.json({ success: false, error: 'Request already resolved' }, { status: 409 });

  if (action === 'decline') {
    const { error } = await supabase.from('client_notifications').update({ status: 'declined' }).eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    await supabase.from('client_notifications').insert({
      client_id: notif.client_id,
      type: 'alert',
      subject: `Request Declined: ${notif.metadata?.storeName ?? ''}`,
      body: `Your ${notif.metadata?.requestType?.toLowerCase() ?? 'request'} for ${notif.metadata?.storeName ?? 'this activation'} on ${notif.metadata?.date ?? ''} could not be approved. Reach out to your Greenline contact for details.`,
      read: false,
      metadata: { storeName: notif.metadata?.storeName, date: notif.metadata?.date },
    });

    return NextResponse.json({ success: true });
  }

  // action === 'approve'
  const requestType = notif.metadata?.requestType;

  if (requestType !== 'New Activation Request') {
    // Edit/Cancel requests reference an existing event that isn't reliably linked here —
    // approving just acknowledges the request; the change itself is applied manually.
    const { error } = await supabase.from('client_notifications').update({ status: 'approved' }).eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const companyName = CLIENT_COMPANY[notif.client_id] ?? notif.client_id;
  const { data: clientRow } = await supabase
    .from('clients')
    .select('id')
    .ilike('company_name', companyName)
    .single();

  const { storeName, address, date, startTime, endTime, market, notes } = notif.metadata ?? {};

  if (!storeName || !date) {
    return NextResponse.json({ success: false, error: 'Request is missing a store name or date' }, { status: 422 });
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      title: `${companyName} - ${storeName}`,
      description: notes ?? '',
      location_name: storeName,
      location_address: address ?? '',
      event_date: date,
      start_time: startTime || null,
      end_time: endTime || null,
      status: 'open',
      city: market || parseCityFromAddress(address) || null,
      client_id: clientRow?.id ?? null,
      brand_name: companyName,
      pay_rate: CLIENT_PAY_RATE[notif.client_id] ?? STANDARD_PAY_RATE,
    })
    .select('id')
    .single();

  if (eventError) return NextResponse.json({ success: false, error: eventError.message }, { status: 500 });

  const { error: updateError } = await supabase
    .from('client_notifications')
    .update({ status: 'approved', event_id: event.id })
    .eq('id', id);

  if (updateError) return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });

  await supabase.from('client_notifications').insert({
    client_id: notif.client_id,
    event_id: event.id,
    type: 'update',
    subject: `Event Confirmed: ${storeName}`,
    body: `Your activation at ${storeName} on ${date} has been approved and scheduled.${startTime && endTime ? ` Time: ${startTime} - ${endTime}.` : ''}`,
    read: false,
    metadata: { storeName, date, startTime, endTime },
  });

  return NextResponse.json({ success: true, eventId: event.id });
}

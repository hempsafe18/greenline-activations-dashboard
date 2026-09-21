import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { supabase } from '../../../../lib/supabase';

// Maps a client's company email domain to the same client keys used across
// the dashboard (CLIENT_COMPANY in app/api/dashboard-stats and
// app/api/event-requests). Returns null for admin/internal or unrecognized
// domains -- those sign-ins are still logged, just with no client_id.
function clientIdFromEmail(email: string): string | null {
  if (email.endsWith('@3chi.com')) return '3CHI';
  if (email.endsWith('@drinkamigos.com')) return 'AMIGOS';
  if (email.endsWith('@mellowfellowcannabis.com') || email.endsWith('@mfdrinks.com')) return 'MELLOW FELLOW';
  if (email.endsWith('@growcannabis.group')) return 'GROW';
  if (email.endsWith('@workingrelief.com')) return 'GROOVEWAGON';
  if (email.endsWith('@drinkwillies.com')) return 'WILLIES_REMEDY';
  if (email.endsWith('@claybourneco.com')) return 'CLAYBOURNE_CO';
  if (email.endsWith('@plift.com')) return 'PLIFT';
  return null;
}

// Fires on every Clerk `session.created` event -- i.e. every time someone
// signs in -- so client logins show up here instead of only in the Clerk
// dashboard's own logs. Configure this endpoint's URL as a webhook in the
// Clerk dashboard (Webhooks > Add Endpoint), subscribed to "session.created",
// and set the signing secret it gives you as CLERK_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req, { signingSecret: process.env.CLERK_WEBHOOK_SECRET });
  } catch (err) {
    console.error('Clerk webhook signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (evt.type !== 'session.created') {
    return NextResponse.json({ received: true });
  }

  const session = evt.data;
  const user = session.user;
  const email = user?.email_addresses.find(e => e.id === user.primary_email_address_id)?.email_address
    ?? user?.email_addresses[0]?.email_address
    ?? null;
  const name = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || null : null;

  try {
    await supabase.from('client_login_events').insert({
      clerk_user_id: session.user_id,
      clerk_session_id: session.id,
      email,
      name,
      client_id: email ? clientIdFromEmail(email) : null,
      ip_address: evt.event_attributes.http_request.client_ip || null,
      user_agent: evt.event_attributes.http_request.user_agent || null,
      occurred_at: new Date(session.created_at).toISOString(),
    });
  } catch (err) {
    console.error('Failed to record client login event', err);
    // Still 200 -- Clerk retries on non-2xx, and a logging failure shouldn't look like a bad webhook.
  }

  return NextResponse.json({ received: true });
}

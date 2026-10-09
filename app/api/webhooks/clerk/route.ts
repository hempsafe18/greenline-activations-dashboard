import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { lookupClerkUser, recordLoginEvent } from '../../../../lib/login-log';

// Fires on every Clerk `session.created` event -- i.e. every time someone
// signs in -- so client logins show up here instead of only in the Clerk
// dashboard's own logs. Configure this endpoint's URL as a webhook in the
// Clerk dashboard (Webhooks > Add Endpoint), subscribed to "session.created",
// and set the signing secret it gives you as CLERK_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  // verifyWebhook falls back to CLERK_WEBHOOK_SIGNING_SECRET (Clerk's default
  // name) when CLERK_WEBHOOK_SECRET is unset.
  if (!process.env.CLERK_WEBHOOK_SECRET && !process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error('Clerk webhook: CLERK_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'CLERK_WEBHOOK_SECRET is not set on this deployment' }, { status: 500 });
  }

  let evt;
  try {
    evt = await verifyWebhook(req, { signingSecret: process.env.CLERK_WEBHOOK_SECRET });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    console.error('Clerk webhook signature verification failed', err);
    // The reason shows in the Clerk endpoint's attempt log (Response tab).
    return NextResponse.json(
      { error: `Signature verification failed: ${reason}. Check CLERK_WEBHOOK_SECRET matches this endpoint's signing secret.` },
      { status: 400 }
    );
  }

  if (evt.type !== 'session.created') {
    return NextResponse.json({ received: true });
  }

  const session = evt.data;
  const user = session.user;
  let email = user?.email_addresses.find(e => e.id === user.primary_email_address_id)?.email_address
    ?? user?.email_addresses[0]?.email_address
    ?? null;
  let name = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || null : null;

  // Clerk's session.created payload usually carries only user_id, not the user
  // object, so fetch the email -- without it the sign-in can't be matched to a
  // client and the admin panel (which only lists client sign-ins) never shows it.
  if (!email && session.user_id) {
    ({ email, name } = await lookupClerkUser(session.user_id));
  }

  try {
    await recordLoginEvent({
      clerk_user_id: session.user_id,
      clerk_session_id: session.id,
      email,
      name,
      ip_address: evt.event_attributes.http_request.client_ip || null,
      user_agent: evt.event_attributes.http_request.user_agent || null,
      occurred_at: new Date(session.created_at).toISOString(),
    });
  } catch (err) {
    console.error('Failed to record client login event', err);
    // 500 so Clerk retries and the failure shows in the endpoint's delivery log
    // instead of the login vanishing silently.
    return NextResponse.json({ error: 'Failed to record login' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

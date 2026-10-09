import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { supabase } from './supabase';

// Maps a client's company email domain to the same client keys used across
// the dashboard (CLIENT_COMPANY in app/api/dashboard-stats and
// app/api/event-requests). Returns null for admin/internal or unrecognized
// domains -- those sign-ins are still logged, just with no client_id.
export function clientIdFromEmail(email: string): string | null {
  const e = email.toLowerCase();
  if (e.endsWith('@3chi.com')) return '3CHI';
  if (e.endsWith('@drinkamigos.com')) return 'AMIGOS';
  if (e.endsWith('@mellowfellowcannabis.com') || e.endsWith('@mfdrinks.com')) return 'MELLOW FELLOW';
  if (e.endsWith('@growcannabis.group')) return 'GROW';
  if (e.endsWith('@workingrelief.com')) return 'GROOVEWAGON';
  if (e.endsWith('@drinkwillies.com')) return 'WILLIES_REMEDY';
  if (e.endsWith('@claybourneco.com')) return 'CLAYBOURNE_CO';
  if (e.endsWith('@plift.com')) return 'PLIFT';
  return null;
}

export interface LoginEventInput {
  clerk_user_id: string;
  clerk_session_id: string | null;
  email: string | null;
  name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: string;
}

/** Inserts one login row. A session already logged (by the webhook or a dashboard load) is skipped. Throws on a real DB error. */
export async function recordLoginEvent(event: LoginEventInput) {
  const row = { ...event, client_id: event.email ? clientIdFromEmail(event.email) : null };
  const { error } = event.clerk_session_id
    ? await supabase.from('client_login_events').upsert(row, { onConflict: 'clerk_session_id', ignoreDuplicates: true })
    : await supabase.from('client_login_events').insert(row);
  if (error) throw new Error(`client_login_events insert failed: ${error.message}`);
}

/**
 * Logs the current Clerk session as a client login the first time that
 * session loads a client dashboard. Backstop for the `session.created` webhook:
 * works even if the webhook isn't configured or its payload has no email.
 * Never throws — logging must not break a page load.
 */
export async function recordClientSession() {
  try {
    const { userId, sessionId } = await auth();
    if (!userId || !sessionId) return;

    // Cheap check first so a repeat load doesn't cost a Clerk API call.
    const { count } = await supabase
      .from('client_login_events')
      .select('id', { count: 'exact', head: true })
      .eq('clerk_session_id', sessionId);
    if (count) return;

    const user = await currentUser();
    const email = user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
      ?? user?.emailAddresses[0]?.emailAddress
      ?? null;
    if (!email || !clientIdFromEmail(email)) return; // only client sign-ins

    const h = await headers();
    await recordLoginEvent({
      clerk_user_id: userId,
      clerk_session_id: sessionId,
      email,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
      ip_address: h.get('x-forwarded-for')?.split(',')[0].trim() || null,
      user_agent: h.get('user-agent'),
      occurred_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to record client session', err);
  }
}

/** Resolves a Clerk user's primary email/name when a webhook payload omits the user object. */
export async function lookupClerkUser(userId: string): Promise<{ email: string | null; name: string | null }> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
      ?? user.emailAddresses[0]?.emailAddress
      ?? null;
    return { email, name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null };
  } catch (err) {
    console.error('Clerk user lookup failed', err);
    return { email: null, name: null };
  }
}

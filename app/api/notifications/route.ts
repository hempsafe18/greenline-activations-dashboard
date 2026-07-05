import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '../../../lib/supabase';

// Derive the client_id from the authenticated user's email domain —
// the same mapping used in app/page.tsx for routing.
function clientIdFromEmail(email: string): string | null {
  if (email.endsWith('@3chi.com')) return '3CHI';
  if (email.endsWith('@drinkamigos.com')) return 'AMIGOS';
  if (email.endsWith('@mellowfellowcannabis.com') || email.endsWith('@mfdrinks.com')) return 'MELLOW FELLOW';
  if (email.endsWith('@growcannabis.group')) return 'GROW';
  if (email.endsWith('@workingrelief.com')) return 'GROOVEWAGON';
  if (email.endsWith('@drinkwillies.com')) return 'WILLIES_REMEDY';
  if (email.endsWith('@plift.com')) return 'PLIFT';
  if (email.endsWith('@greenlineactivations.com')) return null; // admin: allow any client
  return null;
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ notifications: [] }, { status: 401 });

  const requestedClient = new URL(req.url).searchParams.get('client');
  if (!requestedClient) return NextResponse.json({ notifications: [] });

  const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? '';
  const allowedClient = clientIdFromEmail(email);

  // Non-admins must only access their own client's notifications
  if (allowedClient !== null && allowedClient !== requestedClient) {
    return NextResponse.json({ notifications: [] }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('client_notifications')
    .select('*')
    .eq('client_id', requestedClient)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ notifications: [], error: error.message });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ success: false }, { status: 401 });

  const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? '';
  const allowedClient = clientIdFromEmail(email);

  const { id, client, markAllRead } = await req.json();

  if (markAllRead && client) {
    if (allowedClient !== null && allowedClient !== client) {
      return NextResponse.json({ success: false }, { status: 403 });
    }
    const { error } = await supabase.from('client_notifications')
      .update({ read: true }).eq('client_id', client).eq('read', false);
    if (error) return NextResponse.json({ success: false, error: error.message });
    return NextResponse.json({ success: true });
  }

  if (id) {
    // For single-ID updates, verify the notification belongs to the user's client
    if (allowedClient !== null) {
      const { data: notif } = await supabase
        .from('client_notifications')
        .select('client_id')
        .eq('id', id)
        .single();
      if (!notif || notif.client_id !== allowedClient) {
        return NextResponse.json({ success: false }, { status: 403 });
      }
    }
    const { error } = await supabase.from('client_notifications')
      .update({ read: true }).eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
}

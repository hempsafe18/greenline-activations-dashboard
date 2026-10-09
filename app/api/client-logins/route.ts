import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '../../../lib/supabase';

const ADMIN_EMAILS = ["asmar@greenlineactivations.com", "sedell@greenlineactivations.com", "asmar.gary@gmail.com"];

async function requireAdmin() {
  const user = await currentUser();
  const email = user?.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? '';
  if (!user || !ADMIN_EMAILS.includes(email)) return null;
  return user;
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const includeInternal = url.searchParams.get('includeInternal') === 'true';
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 7, 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('client_login_events')
    .select('id, email, name, client_id, occurred_at')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(500);

  if (!includeInternal) query = query.not('client_id', 'is', null);

  const { data, error } = await query;
  if (error) {
    console.error('client-logins query failed', error);
    return NextResponse.json({ logins: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logins: data ?? [], days });
}

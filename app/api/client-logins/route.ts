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
  const onlyClients = url.searchParams.get('onlyClients') !== 'false';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

  let query = supabase
    .from('client_login_events')
    .select('id, email, name, client_id, occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (onlyClients) query = query.not('client_id', 'is', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ logins: [], error: error.message });

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count: todayCount } = await supabase
    .from('client_login_events')
    .select('id', { count: 'exact', head: true })
    .not('client_id', 'is', null)
    .gte('occurred_at', since.toISOString());

  return NextResponse.json({ logins: data ?? [], todayCount: todayCount ?? 0 });
}

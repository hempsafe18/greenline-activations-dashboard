import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '../../../lib/supabase';

const CLIENT_COMPANY: Record<string, string> = {
  AMIGOS:           'Amigos',
  '3CHI':           '3CHI',
  'MELLOW FELLOW':  'Mellow Fellow',
  GROW:             'Grow',
  GROOVEWAGON:      'Groovewagon',
  WILLIES_REMEDY:   "Willie's Remedy",
  CLAYBOURNE_CO:    'Claybourne Co.',
};

function clientIdFromEmail(email: string): string | null {
  if (email.endsWith('@3chi.com')) return '3CHI';
  if (email.endsWith('@drinkamigos.com')) return 'AMIGOS';
  if (email.endsWith('@mellowfellowcannabis.com') || email.endsWith('@mfdrinks.com')) return 'MELLOW FELLOW';
  if (email.endsWith('@growcannabis.group')) return 'GROW';
  if (email.endsWith('@workingrelief.com')) return 'GROOVEWAGON';
  if (email.endsWith('@drinkwillies.com')) return 'WILLIES_REMEDY';
  if (email.endsWith('@claybourneco.com')) return 'CLAYBOURNE_CO';
  if (email.endsWith('@plift.com')) return 'PLIFT';
  if (email.endsWith('@greenlineactivations.com')) return null;
  return null;
}

// Recent, distinct independent-retail activation locations for a client —
// feeds the "Quick Select Location" dropdown on the Request Activation form
// so clients can autofill a known store instead of retyping it. Chain
// locations (e.g. Total Wine) are excluded; those aren't self-serve requests.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ locations: [] }, { status: 401 });

  const requestedClient = new URL(req.url).searchParams.get('client');
  if (!requestedClient || !CLIENT_COMPANY[requestedClient]) {
    return NextResponse.json({ error: 'Invalid client' }, { status: 400 });
  }

  const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? '';
  const allowedClient = clientIdFromEmail(email);
  if (allowedClient !== null && allowedClient !== requestedClient) {
    return NextResponse.json({ locations: [] }, { status: 403 });
  }

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id')
    .ilike('company_name', CLIENT_COMPANY[requestedClient])
    .single();

  if (!clientRow) return NextResponse.json({ locations: [] });

  const { data: events } = await supabase
    .from('events')
    .select('location_name, location_address, city, event_date, start_time, end_time')
    .eq('client_id', clientRow.id)
    .not('location_name', 'ilike', '%total wine%')
    .order('event_date', { ascending: false })
    .limit(200);

  const seen = new Set<string>();
  const locations: { storeName: string; address: string; city: string; startTime: string; endTime: string; lastDate: string }[] = [];

  for (const e of events ?? []) {
    const storeName = e.location_name?.trim();
    if (!storeName) continue;
    const key = storeName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    locations.push({
      storeName,
      address: e.location_address ?? '',
      city: e.city ?? '',
      startTime: e.start_time?.slice(0, 5) ?? '',
      endTime: e.end_time?.slice(0, 5) ?? '',
      lastDate: e.event_date,
    });
    if (locations.length >= 30) break;
  }

  locations.sort((a, b) => a.storeName.localeCompare(b.storeName));

  return NextResponse.json({ locations });
}

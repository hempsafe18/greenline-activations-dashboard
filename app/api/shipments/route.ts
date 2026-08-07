import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '../../../lib/supabase';

// Same brand-code <-> company_name mapping used by /api/client-events, /api/dropdown-data,
// and /api/notifications so this stays consistent with how the rest of the dashboard
// scopes a Clerk-authenticated client to a single client_id.
const CLIENT_COMPANY: Record<string, string> = {
  AMIGOS:          'Amigos',
  '3CHI':          '3CHI',
  'MELLOW FELLOW': 'Mellow Fellow',
  MELLOW_FELLOW:   'Mellow Fellow',
  GROW:            'Grow',
  GROOVEWAGON:     'Groovewagon',
  WILLIES_REMEDY:  "Willie's Remedy",
};

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

// Resolves and authorizes the caller against a requested brand code, returning the
// clients.id UUID for that brand. This app has no Supabase-Auth session for clients
// (auth is Clerk-only, and Next API routes read/write Supabase with the service-role
// key, which bypasses RLS) — so client scoping has to happen here, the same way every
// other client-facing endpoint in this app (client-events, notifications, dropdown-data)
// already does it, rather than via a Postgres RLS policy keyed on auth.uid().
async function authorizeClient(requestedClient: string | null) {
  if (!requestedClient || !CLIENT_COMPANY[requestedClient]) {
    return { error: NextResponse.json({ error: 'Invalid client' }, { status: 400 }) } as const;
  }
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;

  const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? '';
  const allowedClient = clientIdFromEmail(email);
  if (allowedClient !== null && allowedClient !== requestedClient) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id')
    .ilike('company_name', CLIENT_COMPANY[requestedClient])
    .single();

  if (!clientRow) {
    return { error: NextResponse.json({ error: 'Client not found' }, { status: 404 }) } as const;
  }

  return { clientUuid: clientRow.id as string } as const;
}

// GET /api/shipments?client=AMIGOS
// Returns the ambassadors this client is allowed to ship to (confirmed on one of the
// client's own events — never the full roster), the trackable SKUs, and recent shipments.
export async function GET(req: Request) {
  const requestedClient = new URL(req.url).searchParams.get('client');
  const auth = await authorizeClient(requestedClient);
  if ('error' in auth) return auth.error;
  const { clientUuid } = auth;

  const [ambassadorsResult, skusResult, eventsResult, shipmentsResult] = await Promise.all([
    supabase
      .from('applications')
      .select('user_id, status, event:events!inner(client_id), profile:profiles(id, full_name, city, state)')
      .eq('status', 'confirmed')
      .eq('event.client_id', clientUuid),
    supabase
      .from('inventory_skus')
      .select('sku, flavor_name, cans_per_case')
      .order('flavor_name', { ascending: true }),
    supabase
      .from('events')
      .select('id, title, event_date, city')
      .eq('client_id', clientUuid)
      .order('event_date', { ascending: false })
      .limit(50),
    supabase
      .from('ambassador_inventory_shipments')
      .select('id, user_id, sku, event_id, cases_sent, tracking_number, shipped_at, notes, profile:profiles(full_name), sku_info:inventory_skus(flavor_name)')
      .order('shipped_at', { ascending: false })
      .limit(25),
  ]);

  // De-dupe ambassadors confirmed on more than one of this client's events.
  const ambassadorMap = new Map<string, { id: string; full_name: string; city: string | null; state: string | null }>();
  for (const row of ambassadorsResult.data ?? []) {
    const p = row.profile as unknown as { id: string; full_name: string; city: string | null; state: string | null } | null;
    if (p && !ambassadorMap.has(p.id)) ambassadorMap.set(p.id, p);
  }
  const ambassadors = Array.from(ambassadorMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));

  // Recent shipments are scoped to this client's own ambassadors so one client can never
  // see another client's shipment history through this endpoint.
  const allowedIds = new Set(ambassadors.map(a => a.id));
  const recentShipments = (shipmentsResult.data ?? []).filter(s => allowedIds.has(s.user_id));

  return NextResponse.json({
    ambassadors,
    skus: skusResult.data ?? [],
    events: eventsResult.data ?? [],
    recentShipments,
  });
}

// POST /api/shipments
// body: { client, user_id, sku, event_id?, cases_sent, tracking_number, shipped_at, notes? }
export async function POST(req: Request) {
  const body = await req.json();
  const { client, user_id, sku, event_id, cases_sent, tracking_number, shipped_at, notes } = body;

  const auth = await authorizeClient(client);
  if ('error' in auth) return auth.error;
  const { clientUuid } = auth;

  if (!user_id || !sku || !cases_sent || !tracking_number || !shipped_at) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const casesSentNum = Number(cases_sent);
  if (!Number.isFinite(casesSentNum) || casesSentNum <= 0) {
    return NextResponse.json({ error: 'cases_sent must be a positive number' }, { status: 400 });
  }

  // The recipient must be an ambassador confirmed on one of THIS client's own events —
  // this is the actual enforcement point for "clients can only ship to their own roster"
  // (see authorizeClient above for why this can't live in a Postgres RLS policy here).
  const { data: confirmedRow } = await supabase
    .from('applications')
    .select('user_id, event:events!inner(client_id)')
    .eq('user_id', user_id)
    .eq('status', 'confirmed')
    .eq('event.client_id', clientUuid)
    .limit(1)
    .maybeSingle();

  if (!confirmedRow) {
    return NextResponse.json({ error: 'That ambassador is not confirmed on one of your events' }, { status: 403 });
  }

  const { data: skuRow } = await supabase.from('inventory_skus').select('sku').eq('sku', sku).maybeSingle();
  if (!skuRow) {
    return NextResponse.json({ error: 'Unknown SKU' }, { status: 400 });
  }

  if (event_id) {
    const { data: eventRow } = await supabase.from('events').select('id').eq('id', event_id).eq('client_id', clientUuid).maybeSingle();
    if (!eventRow) {
      return NextResponse.json({ error: 'That event does not belong to your account' }, { status: 403 });
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('ambassador_inventory_shipments')
    .insert({
      user_id,
      sku,
      event_id: event_id || null,
      cases_sent: casesSentNum,
      tracking_number,
      shipped_at,
      notes: notes || null,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to log shipment' }, { status: 500 });
  }

  const { data: balance } = await supabase
    .from('inventory_balance_by_ambassador')
    .select('calculated_cans_remaining, total_cans_sent, total_cans_used, flavor_name')
    .eq('user_id', user_id)
    .eq('sku', sku)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    id: inserted.id,
    balance: balance ?? null,
  });
}

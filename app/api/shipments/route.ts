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
  CLAYBOURNE_CO:   'Claybourne Co.',
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

type ShipmentRow = {
  id: string;
  user_id: string;
  sku: string;
  event_id: string | null;
  cases_sent: number;
  tracking_number: string;
  shipped_at: string;
  notes: string | null;
  materials: { item: string; quantity: number }[];
  profile: { full_name: string } | null;
  sku_info: { flavor_name: string } | null;
};

// GET /api/shipments?client=AMIGOS
// Returns the ambassadors this client is allowed to ship to (confirmed on one of the
// client's own events — never the full roster), the trackable SKUs, and recent shipments
// grouped back into one card per tracking_number/shipped_at (they're stored as one row
// per SKU, since a single shipment can cover multiple flavors).
export async function GET(req: Request) {
  const requestedClient = new URL(req.url).searchParams.get('client');
  const auth = await authorizeClient(requestedClient);
  if ('error' in auth) return auth.error;
  const { clientUuid } = auth;

  const [ambassadorsResult, skusResult, eventsResult, shipmentsResult] = await Promise.all([
    supabase
      .from('applications')
      // Address fields are included here (unlike the public ambassador directory in
      // lib/ambassadors.ts, which deliberately excludes them) because this endpoint is
      // authenticated and exists specifically so clients can address a physical shipment.
      .select('user_id, status, event:events!inner(client_id), profile:profiles(id, full_name, city, state, street_address, address_line_2, zip_code)')
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
      .select('id, user_id, sku, event_id, cases_sent, tracking_number, shipped_at, notes, materials, profile:profiles(full_name), sku_info:inventory_skus(flavor_name)')
      .order('shipped_at', { ascending: false })
      .limit(75),
  ]);

  // De-dupe ambassadors confirmed on more than one of this client's events.
  type AmbassadorRow = {
    id: string; full_name: string; city: string | null; state: string | null;
    street_address: string | null; address_line_2: string | null; zip_code: string | null;
  };
  const ambassadorMap = new Map<string, AmbassadorRow>();
  for (const row of ambassadorsResult.data ?? []) {
    const p = row.profile as unknown as AmbassadorRow | null;
    if (p && !ambassadorMap.has(p.id)) ambassadorMap.set(p.id, p);
  }
  const ambassadors = Array.from(ambassadorMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));

  // Recent shipments are scoped to this client's own ambassadors so one client can never
  // see another client's shipment history through this endpoint.
  const allowedIds = new Set(ambassadors.map(a => a.id));
  const rows = ((shipmentsResult.data ?? []) as unknown as ShipmentRow[]).filter(s => allowedIds.has(s.user_id));

  // Re-group the flat per-SKU rows back into one shipment per tracking_number+shipped_at
  // so the client sees "1 box, multiple flavors + materials" instead of duplicate rows.
  const grouped = new Map<string, {
    key: string; user_id: string; ambassador_name: string; tracking_number: string;
    shipped_at: string; notes: string | null; materials: { item: string; quantity: number }[];
    flavors: { sku: string; flavor_name: string; cases_sent: number }[];
  }>();
  for (const row of rows.sort((a, b) => new Date(b.shipped_at).getTime() - new Date(a.shipped_at).getTime())) {
    const key = `${row.user_id}|${row.tracking_number}|${row.shipped_at}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        user_id: row.user_id,
        ambassador_name: row.profile?.full_name || '—',
        tracking_number: row.tracking_number,
        shipped_at: row.shipped_at,
        notes: row.notes,
        materials: row.materials || [],
        flavors: [],
      });
    }
    grouped.get(key)!.flavors.push({ sku: row.sku, flavor_name: row.sku_info?.flavor_name || row.sku, cases_sent: row.cases_sent });
  }
  const recentShipments = Array.from(grouped.values()).slice(0, 25);

  return NextResponse.json({
    ambassadors,
    skus: skusResult.data ?? [],
    events: eventsResult.data ?? [],
    recentShipments,
  });
}

const MAX_ITEMS_PER_SHIPMENT = 3; // one row per flavor; only 3 Amigos SKUs exist today

// POST /api/shipments
// body: { client, user_id, event_id?, items: [{sku, cases_sent}], materials?: [{item, quantity}],
//         tracking_number, shipped_at, notes? }
// `items` is one shipment covering 1-3 flavors; `materials` are non-SKU extras (tablecloth,
// standee, ice bucket, stickers, ...) that rode along in the same box. Inserts one
// ambassador_inventory_shipments row per item, all sharing tracking_number/shipped_at/materials.
export async function POST(req: Request) {
  const body = await req.json();
  const { client, user_id, event_id, items, materials, tracking_number, shipped_at, notes } = body;

  const auth = await authorizeClient(client);
  if ('error' in auth) return auth.error;
  const { clientUuid } = auth;

  if (!user_id || !tracking_number || !shipped_at) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Add at least one flavor to the shipment' }, { status: 400 });
  }
  if (items.length > MAX_ITEMS_PER_SHIPMENT) {
    return NextResponse.json({ error: `A shipment can include at most ${MAX_ITEMS_PER_SHIPMENT} flavors` }, { status: 400 });
  }

  const skus = items.map((i: { sku: string }) => i?.sku);
  if (new Set(skus).size !== skus.length) {
    return NextResponse.json({ error: 'Each flavor can only be listed once per shipment' }, { status: 400 });
  }

  const casesBySku = new Map<string, number>();
  for (const item of items) {
    const casesSentNum = Number(item?.cases_sent);
    if (!item?.sku || !Number.isFinite(casesSentNum) || casesSentNum <= 0) {
      return NextResponse.json({ error: 'Every flavor line needs a SKU and a positive number of cases' }, { status: 400 });
    }
    casesBySku.set(item.sku, casesSentNum);
  }

  const cleanMaterials = Array.isArray(materials)
    ? materials
        .filter((m: { item?: string; quantity?: number }) => m?.item && Number(m.quantity) > 0)
        .map((m: { item: string; quantity: number }) => ({ item: m.item, quantity: Number(m.quantity) }))
    : [];

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

  const { data: skuRows } = await supabase.from('inventory_skus').select('sku').in('sku', skus);
  if (!skuRows || skuRows.length !== skus.length) {
    return NextResponse.json({ error: 'One or more SKUs were not recognized' }, { status: 400 });
  }

  if (event_id) {
    const { data: eventRow } = await supabase.from('events').select('id').eq('id', event_id).eq('client_id', clientUuid).maybeSingle();
    if (!eventRow) {
      return NextResponse.json({ error: 'That event does not belong to your account' }, { status: 403 });
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('ambassador_inventory_shipments')
    .insert(skus.map((sku: string) => ({
      user_id,
      sku,
      event_id: event_id || null,
      cases_sent: casesBySku.get(sku),
      tracking_number,
      shipped_at,
      notes: notes || null,
      materials: cleanMaterials,
    })))
    .select('id');

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to log shipment' }, { status: 500 });
  }

  const { data: balances } = await supabase
    .from('inventory_balance_by_ambassador')
    .select('sku, calculated_cans_remaining, total_cans_sent, total_cans_used, flavor_name')
    .eq('user_id', user_id)
    .in('sku', skus);

  return NextResponse.json({
    success: true,
    ids: inserted.map(r => r.id),
    balances: balances ?? [],
  });
}

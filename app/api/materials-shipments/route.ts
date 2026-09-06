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

// See app/api/shipments/route.ts for why client scoping happens here rather than via
// a Postgres RLS policy keyed on auth.uid() (Clerk-only auth, service-role Supabase client).
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
  event_id: string | null;
  tracking_number: string | null;
  shipped_at: string;
  notes: string | null;
  materials: { item: string; quantity: number }[];
  profile: { full_name: string } | null;
};

// GET /api/materials-shipments?client=CLAYBOURNE_CO
// Returns the ambassadors this client is allowed to ship to (confirmed on one of the
// client's own events), the client's events, and recent materials shipments.
export async function GET(req: Request) {
  const requestedClient = new URL(req.url).searchParams.get('client');
  const auth = await authorizeClient(requestedClient);
  if ('error' in auth) return auth.error;
  const { clientUuid } = auth;

  const [ambassadorsResult, eventsResult, shipmentsResult] = await Promise.all([
    supabase
      .from('applications')
      .select('user_id, status, event:events!inner(client_id), profile:profiles(id, full_name, city, state, street_address, address_line_2, zip_code)')
      .eq('status', 'confirmed')
      .eq('event.client_id', clientUuid),
    supabase
      .from('events')
      .select('id, title, event_date, city')
      .eq('client_id', clientUuid)
      .order('event_date', { ascending: false })
      .limit(50),
    supabase
      .from('ambassador_materials_shipments')
      .select('id, user_id, event_id, tracking_number, shipped_at, notes, materials, profile:profiles(full_name)')
      .eq('client_id', clientUuid)
      .order('shipped_at', { ascending: false })
      .limit(50),
  ]);

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

  const recentShipments = ((shipmentsResult.data ?? []) as unknown as ShipmentRow[]).map(row => ({
    id: row.id,
    ambassador_name: row.profile?.full_name || '—',
    tracking_number: row.tracking_number,
    shipped_at: row.shipped_at,
    notes: row.notes,
    materials: row.materials || [],
  }));

  return NextResponse.json({
    ambassadors,
    events: eventsResult.data ?? [],
    recentShipments,
  });
}

// POST /api/materials-shipments
// body: { client, user_id, event_id?, materials: [{item, quantity}], tracking_number, shipped_at, notes? }
export async function POST(req: Request) {
  const body = await req.json();
  const { client, user_id, event_id, materials, tracking_number, shipped_at, notes } = body;

  const auth = await authorizeClient(client);
  if ('error' in auth) return auth.error;
  const { clientUuid } = auth;

  if (!user_id || !tracking_number || !shipped_at) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const cleanMaterials = Array.isArray(materials)
    ? materials
        .filter((m: { item?: string; quantity?: number }) => m?.item && Number(m.quantity) > 0)
        .map((m: { item: string; quantity: number }) => ({ item: m.item, quantity: Number(m.quantity) }))
    : [];

  if (cleanMaterials.length === 0) {
    return NextResponse.json({ error: 'Add at least one material to the shipment' }, { status: 400 });
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

  if (event_id) {
    const { data: eventRow } = await supabase.from('events').select('id').eq('id', event_id).eq('client_id', clientUuid).maybeSingle();
    if (!eventRow) {
      return NextResponse.json({ error: 'That event does not belong to your account' }, { status: 403 });
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('ambassador_materials_shipments')
    .insert({
      user_id,
      client_id: clientUuid,
      event_id: event_id || null,
      materials: cleanMaterials,
      tracking_number,
      shipped_at,
      notes: notes || null,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to log shipment' }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: inserted.id });
}

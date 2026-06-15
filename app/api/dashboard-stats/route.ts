import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// Map dashboard client IDs to the brand_name values stored in the recaps table
// and the company_name values stored in the clients table (used in events).
const BRAND_NAME_MAP: Record<string, string[]> = {
  '3CHI':         ['3CHI', '3chi'],
  'AMIGOS':       ['AMIGOS', 'Amigos', 'drinkamigos'],
  'MELLOW_FELLOW': ['MELLOW FELLOW', 'Mellow Fellow', 'mellow fellow'],
  'GROW':         ['GROW', 'Grow Cannabis', 'growcannabis'],
};

export async function GET(req: Request) {
  const client = new URL(req.url).searchParams.get('client');
  if (!client || !BRAND_NAME_MAP[client]) {
    return NextResponse.json({ error: 'Invalid client' }, { status: 400 });
  }

  const brandNames = BRAND_NAME_MAP[client];
  const today = new Date().toISOString().split('T')[0];

  // Fetch recaps and upcoming events in parallel
  const [recapsResult, upcomingResult, clientsResult] = await Promise.all([
    supabase
      .from('recaps')
      .select('store_name, consumers_sampled, estimated_units_sold, city, activation_date')
      .in('brand_name', brandNames),
    supabase
      .from('events')
      .select('location_name, event_date, client_id')
      .gte('event_date', today)
      .in('status', ['open', 'closed']),
    supabase
      .from('clients')
      .select('id, company_name'),
  ]);

  // Map client table IDs to company names for upcoming event filtering
  const clientIdToName: Record<string, string> = {};
  for (const c of (clientsResult.data ?? [])) {
    clientIdToName[c.id] = c.company_name;
  }

  const recaps = recapsResult.data ?? [];
  const upcoming = (upcomingResult.data ?? []).filter(e => {
    const name = clientIdToName[e.client_id ?? ''] ?? '';
    return brandNames.some(b => name.toLowerCase().includes(b.toLowerCase()));
  });

  // Compute stats
  let sampled = 0, sold = 0;
  const cityActivations: Record<string, number> = {};
  const monthlyData: Record<string, number> = {};

  for (const r of recaps) {
    sampled += Number(r.consumers_sampled) || 0;
    sold += Number(r.estimated_units_sold) || 0;
    if (r.city) cityActivations[r.city] = (cityActivations[r.city] || 0) + 1;
    if (r.activation_date) {
      const d = new Date(r.activation_date);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = (monthlyData[key] || 0) + 1;
      }
    }
  }

  return NextResponse.json({
    activations: recaps.length,
    sampled,
    sold,
    upcoming: upcoming.length,
    cityActivations,
    monthlyData,
  });
}

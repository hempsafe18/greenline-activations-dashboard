import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

// Brand names as stored in recaps.brand_name (set by RecapForm CLIENT_BRAND_MAP)
const RECAP_BRAND_NAMES: Record<string, string[]> = {
  '3CHI':          ['3CHI', '3chi', '3 CHI'],
  'AMIGOS':        ['AMIGOS', 'Amigos', 'drinkamigos'],
  'MELLOW_FELLOW': ['MELLOW FELLOW', 'Mellow Fellow', 'mellow fellow'],
  'GROW':          ['GROW', 'Grow Cannabis', 'growcannabis'],
};

// Keywords used to match clients.company_name for the events table join
const CLIENT_KEYWORDS: Record<string, string[]> = {
  '3CHI':          ['3chi', '3CHI'],
  'AMIGOS':        ['amigos', 'AMIGOS'],
  'MELLOW_FELLOW': ['mellow', 'fellow'],
  'GROW':          ['grow'],
};

export async function GET(req: Request) {
  const client = new URL(req.url).searchParams.get('client');
  if (!client || !RECAP_BRAND_NAMES[client]) {
    return NextResponse.json({ error: 'Invalid client' }, { status: 400 });
  }

  const brandNames = RECAP_BRAND_NAMES[client];
  const keywords   = CLIENT_KEYWORDS[client];
  const today      = new Date().toISOString().split('T')[0];

  // Step 1: resolve the client IDs for this brand from the clients table
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, company_name');

  const matchedClientIds = (allClients ?? [])
    .filter(c => keywords.some(k => c.company_name.toLowerCase().includes(k)))
    .map(c => c.id);

  // Step 2: fetch recaps + upcoming events + all events (for city/monthly data) in parallel
  const [recapsResult, upcomingResult, pastEventsResult] = await Promise.all([
    // Completed activations — source of truth for sampled/sold/conversion
    supabase
      .from('recaps')
      .select('consumers_sampled, estimated_units_sold, city, activation_date')
      .in('brand_name', brandNames),

    // Upcoming events — use client_id match when available, fall back to title keyword search
    supabase
      .from('events')
      .select('id, event_date, city')
      .gte('event_date', today)
      .in('status', ['open', 'closed'])
      .or(
        matchedClientIds.length > 0
          ? `client_id.in.(${matchedClientIds.join(',')}),${keywords.map(k => `title.ilike.%${k}%`).join(',')}`
          : keywords.map(k => `title.ilike.%${k}%`).join(',')
      ),

    // All events (past + future) for city and monthly trend data
    supabase
      .from('events')
      .select('event_date, city, status')
      .in('status', ['open', 'closed', 'completed'])
      .or(
        matchedClientIds.length > 0
          ? `client_id.in.(${matchedClientIds.join(',')}),${keywords.map(k => `title.ilike.%${k}%`).join(',')}`
          : keywords.map(k => `title.ilike.%${k}%`).join(',')
      ),
  ]);

  const recaps      = recapsResult.data ?? [];
  const upcoming    = upcomingResult.data ?? [];
  const pastEvents  = pastEventsResult.data ?? [];

  // Step 3: compute stats
  let sampled = 0, sold = 0;
  const cityActivations: Record<string, number> = {};
  const monthlyData: Record<string, number> = {};

  // Recaps drive conversion metrics and completed activation count
  for (const r of recaps) {
    sampled += Number(r.consumers_sampled) || 0;
    sold    += Number(r.estimated_units_sold) || 0;

    // City from recap
    const city = r.city?.trim();
    if (city) cityActivations[city] = (cityActivations[city] || 0) + 1;

    // Monthly trend from recap date
    if (r.activation_date) {
      const d = new Date(r.activation_date);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = (monthlyData[key] || 0) + 1;
      }
    }
  }

  // Merge city data from events (fills gaps where a recap has no city but the event does)
  for (const e of pastEvents) {
    const city = e.city?.trim();
    if (city && !cityActivations[city]) {
      // Only add cities not already counted from recaps to avoid double-counting
      cityActivations[city] = (cityActivations[city] || 0) + 1;
    }

    // Fill monthly trend gaps from completed events that have no recap yet
    if (e.status === 'completed' && e.event_date) {
      const d = new Date(e.event_date);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = 0; // don't double-count, just ensure key exists
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

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

const RECAP_BRAND_NAMES: Record<string, string[]> = {
  AMIGOS:           ['AMIGOS', 'Amigos', 'drinkamigos'],
  '3CHI':           ['3CHI', '3chi', '3 CHI'],
  'MELLOW FELLOW':  ['MELLOW FELLOW', 'Mellow Fellow', 'mellow fellow'],
  GROW:             ['GROW', 'Grow', 'Grow Cannabis'],
  GROOVEWAGON:      ['Groovewagon', 'GROOVEWAGON', 'groovewagon'],
  WILLIES_REMEDY:   ["Willie's Remedy", 'Willies Remedy', 'WILLIES REMEDY'],
  CLAYBOURNE_CO:    ['Claybourne Co.', 'Claybourne', 'CLAYBOURNE'],
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

function formatTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requestedClient = new URL(req.url).searchParams.get('client');
  if (!requestedClient || !CLIENT_COMPANY[requestedClient]) {
    return NextResponse.json({ error: 'Invalid client' }, { status: 400 });
  }

  const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? '';
  const allowedClient = clientIdFromEmail(email);
  if (allowedClient !== null && allowedClient !== requestedClient) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = new Date().toISOString().split('T')[0];
  const brandNames = RECAP_BRAND_NAMES[requestedClient] ?? [];

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id')
    .ilike('company_name', CLIENT_COMPANY[requestedClient])
    .single();

  const clientUuid = clientRow?.id;

  const [upcomingResult, recapsResult] = await Promise.all([
    supabase
      .from('events')
      .select('id, event_date, start_time, end_time, location_name, location_address, city, description, status')
      .eq('client_id', clientUuid ?? '00000000-0000-0000-0000-000000000000')
      .gte('event_date', today)
      .in('status', ['open', 'closed'])
      .order('event_date', { ascending: true }),

    supabase
      .from('recaps')
      .select('*')
      .in('brand_name', brandNames)
      .order('activation_date', { ascending: false }),
  ]);

  const upcoming = upcomingResult.data ?? [];
  const recaps = recapsResult.data ?? [];

  // Aggregate stats from recaps
  let sampled = 0, sold = 0;
  const cityMap: Record<string, number> = {};
  const flavorMap: Record<string, number> = {};

  for (const r of recaps) {
    sampled += Number(r.consumers_sampled) || 0;
    sold += Number(r.estimated_units_sold) || 0;
    const city = r.city?.trim();
    if (city) cityMap[city] = (cityMap[city] || 0) + 1;
    const flavor = r.top_performing_flavor?.trim();
    if (flavor) flavorMap[flavor] = (flavorMap[flavor] || 0) + 1;
  }

  const markets = Object.entries(cityMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([city, value]) => ({ city, value }));

  // Build intel items
  let topFlavor = '';
  let topFlavorCount = 0;
  for (const [flavor, count] of Object.entries(flavorMap)) {
    if (count > topFlavorCount) { topFlavor = flavor; topFlavorCount = count; }
  }

  const intel: { type: string; icon: string; text: string; link?: string }[] = [];
  if (topFlavor) {
    intel.push({ type: 'flavor', icon: '🏆', text: `Top performing SKU across recent activations is ${topFlavor}.` });
  }
  for (const r of recaps.slice(0, 10)) {
    const obj = r.consumer_objections?.trim();
    if (obj && obj.toLowerCase() !== 'none' && obj !== '') {
      intel.push({ type: 'objection', icon: '💬', text: `Objection at ${r.store_name || r.city}: ${obj}` });
    }
    const photoFields = [r.engagement_photos, r.setup_photo, r.shelf_photo].filter(Boolean) as string[];
    for (const field of photoFields) {
      const urls = field.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('http'));
      for (const url of urls) {
        intel.push({ type: 'photo', icon: '📸', text: `Engagement photo from ${r.store_name || r.city}.`, link: url });
      }
    }
  }

  // Shape upcoming events for the calendar
  const upcomingFormatted = upcoming.map(e => ({
    id: e.id,
    date: new Date(e.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
    store: e.location_name,
    market: e.city || '',
    address: e.location_address || '',
    time: e.start_time && e.end_time ? `${formatTime(e.start_time)} - ${formatTime(e.end_time)}` : '',
    products: e.description || '',
    status: 'Upcoming',
    sortDate: e.event_date,
  }));

  // Shape recaps as previous/completed events
  const previousFormatted = recaps.map(r => ({
    id: r.id,
    date: r.activation_date || '',
    store: r.store_name || '',
    market: r.city || '',
    time: r.shift_start_time && r.shift_end_time
      ? `${r.shift_start_time} - ${r.shift_end_time}`
      : r.shift_start_time || '',
    status: 'Complete',
    sortDate: r.activation_date || '',
    recap: r,
  }));

  return NextResponse.json({
    upcoming: upcomingFormatted,
    previous: previousFormatted,
    sampled,
    sold,
    activations: recaps.length,
    conversion: sampled > 0 ? Math.round((sold / sampled) * 100) : 0,
    markets,
    intel: intel.slice(0, 5),
  });
}

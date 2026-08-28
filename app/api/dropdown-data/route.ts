import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

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

const RECAP_BRAND_NAMES: Record<string, string[]> = {
  AMIGOS:          ['AMIGOS', 'Amigos', 'drinkamigos'],
  '3CHI':          ['3CHI', '3chi', '3 CHI'],
  'MELLOW FELLOW': ['MELLOW FELLOW', 'Mellow Fellow', 'mellow fellow'],
  MELLOW_FELLOW:   ['MELLOW FELLOW', 'Mellow Fellow', 'mellow fellow'],
  GROW:            ['GROW', 'Grow', 'Grow Cannabis'],
  GROOVEWAGON:     ['Groovewagon', 'GROOVEWAGON', 'groovewagon'],
  WILLIES_REMEDY:  ["Willie's Remedy", 'Willies Remedy', 'WILLIES REMEDY'],
  CLAYBOURNE_CO:   ['Claybourne Co.', 'Claybourne', 'CLAYBOURNE'],
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const client = searchParams.get('client');

  if (!client || !CLIENT_COMPANY[client]) {
    return NextResponse.json({ error: 'Invalid client' }, { status: 400 });
  }

  const brandNames = RECAP_BRAND_NAMES[client] ?? [];

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id')
    .ilike('company_name', CLIENT_COMPANY[client])
    .single();

  const clientUuid = clientRow?.id;

  const [eventsResult, recapsResult] = await Promise.all([
    supabase
      .from('events')
      .select('city')
      .eq('client_id', clientUuid ?? '00000000-0000-0000-0000-000000000000'),
    supabase
      .from('recaps')
      .select('sampling_type, products_featured, brand_name')
      .in('brand_name', brandNames),
  ]);

  const cities = new Set<string>();
  for (const e of eventsResult.data ?? []) {
    if (e.city?.trim()) cities.add(e.city.trim());
  }

  const samplingTypes = new Set<string>();
  const products = new Set<string>();
  for (const r of recapsResult.data ?? []) {
    if (r.sampling_type?.trim()) samplingTypes.add(r.sampling_type.trim());
    if (r.products_featured?.trim()) {
      r.products_featured.split(',').forEach((p: string) => {
        const t = p.trim();
        if (t) products.add(t);
      });
    }
  }

  return NextResponse.json({
    market: Array.from(cities).sort(),
    brand: [CLIENT_COMPANY[client]],
    samplingType: Array.from(samplingTypes).sort(),
    productPurchase: ['Yes', 'No'],
    products: Array.from(products).sort(),
  });
}

import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const event_id = searchParams.get('event_id');
  const user_id = searchParams.get('user_id');

  if (!event_id || !user_id) {
    return NextResponse.json(
      { success: false, error: 'event_id and user_id are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('shift_tallies')
    .select('category, count')
    .eq('event_id', event_id)
    .eq('user_id', user_id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    totals[row.category] = row.count;
  }

  return NextResponse.json({
    success: true,
    approached: totals['approached'] ?? 0,
    sampled: totals['sampled'] ?? 0,
    sold: totals['sold'] ?? 0,
  });
}

import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET() {
  const { data: meetings, error } = await supabase
    .from('sales_meetings')
    .select('*, sales_meeting_recaps(id)')
    .eq('brand', 'Grow')
    .eq('status', 'open')
    .order('meeting_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter: keep only meetings without a recap (meeting_date hasn't been recapped yet)
  const upcoming = (meetings || []).filter((m: any) =>
    !m.sales_meeting_recaps || m.sales_meeting_recaps.length === 0
  );

  return NextResponse.json({ meetings: upcoming });
}

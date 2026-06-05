import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.MIGRATION_SECRET || 'dev-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Insert Prudential Club order directly
    const { data: visit, error } = await supabase
      .from('sales_visits')
      .insert({
        client_id: 'GROW',
        rep_name: 'Sales Rep',
        account_name: 'Prudential Club',
        city: 'Fernandina Beach',
        is_new_account: false,
        visit_date: '2026-06-04',
        sku: 'GRW-MIXED',
        qty_ordered: 3,
        unit_wholesale: 100,
        line_total: 300,
        notes: 'Order placed - 3 cases totaling $300',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Prudential Club order added to sales_visits',
      visit,
    });
  } catch (err) {
    console.error('Seed error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

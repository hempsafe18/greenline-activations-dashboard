import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(req: Request) {
  try {
    // Check for authorization
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.MIGRATION_SECRET || 'dev-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all recaps from sales_meeting_recaps for Grow brand
    const { data: recaps, error: recapsError } = await supabase
      .from('sales_meeting_recaps')
      .select('*')
      .eq('brand', 'Grow');

    if (recapsError) {
      return NextResponse.json({ error: recapsError.message }, { status: 500 });
    }

    if (!recaps || recaps.length === 0) {
      return NextResponse.json({ message: 'No recaps found to migrate', migrated: 0 });
    }

    // Migrate each recap to sales_visits
    const migrations = await Promise.all(
      (recaps || []).map(async (r: any) => {
        const totalQty = r.order_skus?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
        const totalRevenue = Number(r.order_total) || 0;

        // Only migrate if there's an order
        if (totalQty === 0 && totalRevenue === 0) {
          return { id: r.id, migrated: false, reason: 'No order data' };
        }

        const { data: visit, error } = await supabase
          .from('sales_visits')
          .insert({
            client_id: 'GROW',
            rep_name: r.rep_name || '',
            account_name: r.account_visited || r.account_name || '',
            city: r.city || null,
            is_new_account: false,
            visit_date: r.visit_date,
            sku: r.order_skus?.[0]?.sku || null,
            qty_ordered: totalQty,
            unit_wholesale: 0,
            line_total: totalRevenue,
            notes: r.summary || r.notes || null,
          })
          .select()
          .single();

        if (error) {
          return { id: r.id, migrated: false, reason: error.message };
        }

        return { id: r.id, migrated: true, newVisitId: visit?.id };
      })
    );

    const successful = migrations.filter((m: any) => m.migrated).length;

    return NextResponse.json({
      message: `Migrated ${successful} recaps to sales_visits`,
      migrated: successful,
      total: recaps.length,
      details: migrations,
    });
  } catch (err) {
    console.error('Migration error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

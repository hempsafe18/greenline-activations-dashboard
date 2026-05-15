import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { repName, accountName, city, isNewAccount, visitDate, sku, qtyOrdered, unitWholesale, notes } = body;
    const lineTotal = Number(qtyOrdered || 0) * Number(unitWholesale || 0);

    const { data: visit, error } = await supabase
      .from('sales_visits')
      .insert({
        client_id: 'GROW',
        rep_name: repName,
        account_name: accountName,
        city: city || null,
        is_new_account: Boolean(isNewAccount),
        visit_date: visitDate,
        sku: sku || null,
        qty_ordered: Number(qtyOrdered) || 0,
        unit_wholesale: Number(unitWholesale) || 0,
        line_total: lineTotal,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const { data: allVisits } = await supabase
      .from('sales_visits')
      .select('qty_ordered')
      .eq('client_id', 'GROW');

    const totalSold = (allVisits || []).reduce((s: number, v: any) => s + (Number(v.qty_ordered) || 0), 0);
    const inventory = Math.max(0, 100 - totalSold);

    if (inventory <= 30) {
      await supabase.from('client_notifications').insert({
        client_id: 'GROW',
        type: 'alert',
        subject: `⚠️ Low Inventory: ${inventory} cases remaining`,
        body: `Warehouse inventory has dropped to ${inventory} cases (replenish at ≤30). Last shipment: ${qtyOrdered} cases to ${accountName} by ${repName || 'team'}.`,
        read: false,
        metadata: { inventory, totalSold },
      });
    }

    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (token) {
      await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: {
            dealname: `${isNewAccount ? 'NEW ACCOUNT' : 'Visit'}: ${accountName} (GROW)`,
            description: `Rep: ${repName}\nDate: ${visitDate}\nCity: ${city || 'N/A'}\nSKU: ${sku || 'N/A'}\nCases: ${qtyOrdered}\nUnit Wholesale: $${unitWholesale}\nLine Total: $${lineTotal.toFixed(2)}\nNotes: ${notes || 'None'}`,
            amount: lineTotal.toFixed(2),
            pipeline: '883257455',
            dealstage: '1327057675',
          },
        }),
      }).catch(e => console.error('HubSpot error:', e));
    }

    return NextResponse.json({ success: true, visit, inventory });
  } catch (err) {
    console.error('Visit POST error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

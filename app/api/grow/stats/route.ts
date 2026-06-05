import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

// Parse the city out of a full address. Handles both multi-line
// ("123 Main St\nFernandina Beach, FL 32034") and single-line
// ("123 Main St, Fernandina Beach, FL 32034") formats. After
// normalizing newlines to commas, the city is the segment just
// before the "STATE ZIP" segment (i.e. second-to-last).
const parseCity = (address: string | null): string => {
  if (!address) return '';
  const parts = address
    .replace(/\n/g, ',')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || '';
};

// Parse the city out of a full address. Handles both multi-line
// ("123 Main St\nFernandina Beach, FL 32034") and single-line
// ("123 Main St, Fernandina Beach, FL 32034") formats. After
// normalizing newlines to commas, the city is the segment just
// before the "STATE ZIP" segment (i.e. second-to-last).
const parseCity = (address: string | null): string => {
  if (!address) return '';
  const parts = address
    .replace(/\n/g, ',')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || '';
};

export async function GET() {
  const { data: recaps, error } = await supabase
    .from('sales_meeting_recaps')
    .select('*, sales_meetings(location_address)')
    .eq('brand', 'Grow')
    .order('visit_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const visits: any[] = [];
  const accountMap: Record<string, any> = {};

  (recaps || []).forEach((r: any) => {
    const accountName = r.account_visited || r.account_name || '';
    if (!accountName) return;

    const totalQty = r.order_skus?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
    const totalRevenue = Number(r.order_total) || 0;
    const hasOrder = totalQty > 0 || totalRevenue > 0;
    const city = parseCity(r.sales_meetings?.location_address || '');

    // Order History: only confirmed orders with case quantity or revenue.
    if (hasOrder) {
      visits.push({
        visit_date: r.visit_date,
        rep_name: r.rep_name,
        account_name: accountName,
        city,
        sku: r.order_skus?.[0]?.sku || '',
        qty_ordered: totalQty,
        unit_wholesale: 0,
        line_total: totalRevenue,
        recap_id: r.id,
      });
    }

    // Accounts: every visited account appears, regardless of order.
    if (!accountMap[accountName]) {
      accountMap[accountName] = {
        name: accountName,
        city,
        isNew: false,
        lastVisit: r.visit_date,
        totalCases: 0,
        totalRevenue: 0,
        visitCount: 0,
        recaps: [],
      };
    }
    const acc = accountMap[accountName];
    if (city && !acc.city) acc.city = city;
    acc.totalCases += totalQty;
    acc.totalRevenue += totalRevenue;
    acc.visitCount += 1;
    if (r.visit_date > acc.lastVisit) acc.lastVisit = r.visit_date;

    // Full recap detail for the account modal.
    acc.recaps.push({
      visit_date: r.visit_date,
      rep_name: r.rep_name,
      buyer_met_with: r.buyer_met_with || r.buyer_name || '',
      city,
      time_in: r.time_in,
      time_out: r.time_out,
      outcome: r.outcome || '',
      buyer_receptiveness: r.buyer_receptiveness || 0,
      summary: r.summary || '',
      sku: r.order_skus?.[0]?.sku || '',
      qty_ordered: totalQty,
      line_total: totalRevenue,
      po_number: r.po_number || '',
      expected_delivery: r.expected_delivery || '',
      objections: r.objections || r.objections_raised || '',
      objection_handling: r.objection_handling || '',
      next_visit_timing: r.next_visit_timing || '',
      next_visit_notes: r.next_visit_note || r.next_visit_notes || '',
      rep_notes: r.rep_notes || '',
    });
  });

  const accounts = Object.values(accountMap).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);
  const casesSold = visits.reduce((s: number, v: any) => s + (Number(v.qty_ordered) || 0), 0);
  const revenue = visits.reduce((s: number, v: any) => s + (Number(v.line_total) || 0), 0);

  return NextResponse.json({
    accountsVisited: accounts.length,
    newAccounts: 0,
    casesSold,
    inventory: Math.max(0, 100 - casesSold),
    revenue,
    commission: revenue * 0.1,
    accounts,
    visits,
  });
}

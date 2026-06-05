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

export async function GET() {
  const { data: visits, error } = await supabase
    .from('sales_visits')
    .select('*')
    .eq('client_id', 'GROW')
    .order('visit_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const visitsArray: any[] = [];
  const accountMap: Record<string, any> = {};

  (visits || []).forEach((v: any) => {
    const accountName = v.account_name || '';
    if (!accountName) return;

    const totalQty = Number(v.qty_ordered) || 0;
    const totalRevenue = Number(v.line_total) || 0;
    const hasOrder = totalQty > 0 || totalRevenue > 0;
    const city = v.city || '';

    // Order History: only confirmed orders with case quantity or revenue.
    if (hasOrder) {
      visitsArray.push({
        visit_date: v.visit_date,
        rep_name: v.rep_name,
        account_name: accountName,
        city,
        sku: v.sku || '',
        qty_ordered: totalQty,
        unit_wholesale: Number(v.unit_wholesale) || 0,
        line_total: totalRevenue,
        visit_id: v.id,
      });
    }

    // Accounts: every visited account appears, regardless of order.
    if (!accountMap[accountName]) {
      accountMap[accountName] = {
        name: accountName,
        city,
        isNew: Boolean(v.is_new_account),
        lastVisit: v.visit_date,
        totalCases: 0,
        totalRevenue: 0,
        visitCount: 0,
        recaps: [],
      };
    }
    const acc = accountMap[accountName];
    if (city && !acc.city) acc.city = city;
    if (v.is_new_account) acc.isNew = true;
    acc.totalCases += totalQty;
    acc.totalRevenue += totalRevenue;
    acc.visitCount += 1;
    if (v.visit_date > acc.lastVisit) acc.lastVisit = v.visit_date;

    // Full visit detail for the account modal.
    acc.recaps.push({
      visit_date: v.visit_date,
      rep_name: v.rep_name,
      account_name: accountName,
      city,
      sku: v.sku || '',
      qty_ordered: totalQty,
      unit_wholesale: Number(v.unit_wholesale) || 0,
      line_total: totalRevenue,
      notes: v.notes || '',
      is_new_account: Boolean(v.is_new_account),
    });
  });

  const accounts = Object.values(accountMap).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);
  const newAccounts = accounts.filter((a: any) => a.isNew).length;
  const casesSold = visitsArray.reduce((s: number, v: any) => s + (Number(v.qty_ordered) || 0), 0);
  const revenue = visitsArray.reduce((s: number, v: any) => s + (Number(v.line_total) || 0), 0);

  return NextResponse.json({
    accountsVisited: accounts.length,
    newAccounts,
    casesSold,
    inventory: Math.max(0, 100 - casesSold),
    revenue,
    commission: revenue * 0.1,
    accounts,
    visits: visitsArray,
  });
}

import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

const parseCity = (address: string | null): string => {
  if (!address) return '';
  const parts = address.split(',').map(p => p.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : '';
};

export async function GET() {
  const { data: recaps, error } = await supabase
    .from('sales_meeting_recaps')
    .select('*, sales_meetings(address)')
    .eq('brand', 'Grow')
    .order('visit_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const visits: any[] = [];
  const accountMap: Record<string, any> = {};

  (recaps || []).forEach((r: any) => {
    const accountName = r.account_visited || r.account_name || '';
    const totalQty = r.order_skus?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
    const totalRevenue = Number(r.order_total) || 0;
    const hasOrder = totalQty > 0 || totalRevenue > 0;

    if (accountName && hasOrder) {
      const city = parseCity(r.sales_meetings?.address || '');
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
        recap_data: r,
      });

      if (!accountMap[accountName]) {
        accountMap[accountName] = {
          name: accountName,
          city,
          isNew: false,
          lastVisit: r.visit_date,
          totalCases: 0,
          totalRevenue: 0,
          visitCount: 0,
        };
      }
      const acc = accountMap[accountName];
      acc.totalCases += totalQty;
      acc.totalRevenue += totalRevenue;
      acc.visitCount += 1;
      if (r.visit_date > acc.lastVisit) acc.lastVisit = r.visit_date;
    }
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

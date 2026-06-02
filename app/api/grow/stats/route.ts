import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET() {
  const { data: recaps, error } = await supabase
    .from('sales_meeting_recaps')
    .select('*')
    .eq('brand', 'Grow')
    .order('visit_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const visits: any[] = [];
  const accountMap: Record<string, any> = {};

  (recaps || []).forEach((r: any) => {
    const accountName = r.account_visited || r.account_name || '';
    if (accountName) {
      visits.push({
        visit_date: r.visit_date,
        rep_name: r.rep_name,
        account_name: accountName,
        sku: r.order_skus?.[0]?.sku || '',
        qty_ordered: r.order_skus?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0,
        unit_wholesale: 0,
        line_total: Number(r.order_total) || 0,
      });

      if (!accountMap[accountName]) {
        accountMap[accountName] = {
          name: accountName,
          isNew: false,
          lastVisit: r.visit_date,
          totalCases: 0,
          totalRevenue: 0,
          visitCount: 0,
        };
      }
      const acc = accountMap[accountName];
      acc.totalCases += r.order_skus?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
      acc.totalRevenue += Number(r.order_total) || 0;
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

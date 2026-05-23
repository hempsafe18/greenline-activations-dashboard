import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET() {
  const { data: visits, error } = await supabase
    .from('sales_visits')
    .select('account_name,is_new_account,visit_date,qty_ordered,line_total,client_id')
    .eq('client_id', 'GROW')
    .order('visit_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const v = visits || [];

  const accountMap: Record<string, any> = {};
  v.forEach((r: any) => {
    if (!accountMap[r.account_name]) {
      accountMap[r.account_name] = {
        name: r.account_name, isNew: r.is_new_account,
        lastVisit: r.visit_date, totalCases: 0, totalRevenue: 0, visitCount: 0
      };
    }
    const acc = accountMap[r.account_name];
    acc.totalCases += Number(r.qty_ordered) || 0;
    acc.totalRevenue += Number(r.line_total) || 0;
    acc.visitCount += 1;
    if (r.visit_date > acc.lastVisit) acc.lastVisit = r.visit_date;
  });

  const accounts = Object.values(accountMap).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);
  const casesSold = v.reduce((s: number, r: any) => s + (Number(r.qty_ordered) || 0), 0);
  const revenue = v.reduce((s: number, r: any) => s + (Number(r.line_total) || 0), 0);

  return NextResponse.json({
    accountsVisited: accounts.length,
    newAccounts: v.filter((r: any) => r.is_new_account).length,
    casesSold,
    inventory: Math.max(0, 100 - casesSold),
    revenue,
    commission: revenue * 0.1,
    accounts,
    visits: v,
  });
}

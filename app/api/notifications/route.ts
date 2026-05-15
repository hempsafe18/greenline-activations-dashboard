import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(req: Request) {
  const client = new URL(req.url).searchParams.get('client');
  if (!client) return NextResponse.json({ notifications: [] });
  const { data, error } = await supabase
    .from('client_notifications')
    .select('*')
    .eq('client_id', client)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ notifications: [], error: error.message });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH(req: Request) {
  const { id, client, markAllRead } = await req.json();
  if (markAllRead && client) {
    const { error } = await supabase.from('client_notifications')
      .update({ read: true }).eq('client_id', client).eq('read', false);
    if (error) return NextResponse.json({ success: false, error: error.message });
    return NextResponse.json({ success: true });
  }
  if (id) {
    const { error } = await supabase.from('client_notifications')
      .update({ read: true }).eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
}

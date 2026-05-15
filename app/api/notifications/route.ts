import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const client = searchParams.get('client');
  if (!client) return NextResponse.json({ notifications: [] });

  const { data, error } = await supabase
    .from('client_notifications')
    .select('*')
    .eq('client_id', client)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Notifications fetch error:', error.message);
    return NextResponse.json({ notifications: [], error: error.message });
  }
  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, client, markAllRead } = body;

    if (markAllRead && client) {
      const { error } = await supabase
        .from('client_notifications')
        .update({ read: true })
        .eq('client_id', client)
        .eq('read', false);
      if (error) return NextResponse.json({ success: false, error: error.message });
      return NextResponse.json({ success: true });
    }

    if (id) {
      const { error } = await supabase
        .from('client_notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) return NextResponse.json({ success: false, error: error.message });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Notifications PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

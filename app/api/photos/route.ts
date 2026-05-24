import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

type EventPhoto = {
  key: string;
  title: string;
  date: string;
  photos: string[];
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const client = searchParams.get('client');
  if (!client) {
    return NextResponse.json({ error: 'client param required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { data: items, error } = await supabase.storage
    .from('recap-photos')
    .list(client, { limit: 200, sortBy: { column: 'name', order: 'desc' } });

  if (error) {
    // If the client folder doesn't exist yet, return empty gracefully
    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      return NextResponse.json({ events: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ events: [] });
  }

  type StorageItem = (typeof items)[number];
  const folders = items.filter((item: StorageItem) => !item.id || item.metadata === null);
  const directFiles = items.filter(
    (item: StorageItem) => item.id && item.metadata && (item.metadata as Record<string, unknown>)['size'] && !item.name.startsWith('.')
  );

  const events: EventPhoto[] = [];

  for (const folder of folders) {
    if (folder.name.startsWith('.')) continue;

    const { data: files } = await supabase.storage
      .from('recap-photos')
      .list(`${client}/${folder.name}`, { limit: 100 });

    const photos = (files || [])
      .filter((f: StorageItem) => f.metadata && (f.metadata as Record<string, unknown>)['size'] && !f.name.startsWith('.'))
      .map((f: StorageItem) => `${supabaseUrl}/storage/v1/object/public/recap-photos/${client}/${folder.name}/${f.name}`);

    if (photos.length === 0) continue;

    // Folder name convention: "2026-05-22_total-wine-805"
    // Parse into a human-readable title
    const underscoreIdx = folder.name.indexOf('_');
    const datePart = underscoreIdx > -1 ? folder.name.slice(0, underscoreIdx) : '';
    const storePart = underscoreIdx > -1 ? folder.name.slice(underscoreIdx + 1) : folder.name;
    const storeTitle = storePart.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const title = datePart ? `${storeTitle} · ${datePart}` : storeTitle;

    events.push({ key: folder.name, title, date: datePart, photos });
  }

  if (directFiles.length > 0) {
    const photos = directFiles.map(
      (f: StorageItem) => `${supabaseUrl}/storage/v1/object/public/recap-photos/${client}/${f.name}`
    );
    events.unshift({ key: '__recent', title: 'Recent Photos', date: '', photos });
  }

  return NextResponse.json({ events });
}

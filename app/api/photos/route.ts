import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

type PhotoGroup = {
  key: string;
  title: string;
  date: string;
  photos: string[];
};

// Storage folder names differ from URL-friendly client slugs in some cases
const STORAGE_SLUG: Record<string, string> = {
  'mellow-fellow': 'mellow_fellow',
};

const TYPE_LABELS: Record<string, string> = {
  engagement: 'Engagement Photos',
  setup: 'Setup Photos',
  shelf: 'Shelf Photos',
};

const SIGNED_URL_TTL = 3600; // 1 hour

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const client = searchParams.get('client');
  if (!client) {
    return NextResponse.json({ error: 'client param required' }, { status: 400 });
  }

  const storageFolder = STORAGE_SLUG[client] ?? client;

  // List type subfolders under the client folder (engagement, setup, shelf)
  const { data: items, error } = await supabase.storage
    .from('recap-photos')
    .list(storageFolder, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

  if (error) {
    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      return NextResponse.json({ events: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ events: [] });
  }

  type StorageItem = (typeof items)[number];
  const typeFolders = items.filter((item: StorageItem) => !item.id || item.metadata === null);

  const groups: PhotoGroup[] = [];

  for (const folder of typeFolders) {
    if (folder.name.startsWith('.')) continue;

    const { data: files } = await supabase.storage
      .from('recap-photos')
      .list(`${storageFolder}/${folder.name}`, { limit: 200 });

    const filePaths = (files ?? [])
      .filter((f: StorageItem) => {
        const size = (f.metadata as Record<string, unknown> | null)?.['size'] as number | undefined;
        return size && size > 0 && !f.name.startsWith('.');
      })
      .map((f: StorageItem) => `${storageFolder}/${folder.name}/${f.name}`);

    if (filePaths.length === 0) continue;

    // Generate signed URLs for all files in this folder in one batch call
    const { data: signedData, error: signErr } = await supabase.storage
      .from('recap-photos')
      .createSignedUrls(filePaths, SIGNED_URL_TTL);

    if (signErr || !signedData) continue;

    const signedUrls = signedData
      .map(r => r.signedUrl)
      .filter((url): url is string => !!url);

    if (signedUrls.length === 0) continue;

    groups.push({
      key: folder.name,
      title: TYPE_LABELS[folder.name] ?? folder.name.charAt(0).toUpperCase() + folder.name.slice(1),
      date: '',
      photos: signedUrls,
    });
  }

  // Order: engagement → shelf → setup
  const ORDER = ['engagement', 'shelf', 'setup'];
  groups.sort(
    (a, b) => (ORDER.indexOf(a.key) === -1 ? 99 : ORDER.indexOf(a.key)) -
               (ORDER.indexOf(b.key) === -1 ? 99 : ORDER.indexOf(b.key))
  );

  return NextResponse.json({ events: groups });
}

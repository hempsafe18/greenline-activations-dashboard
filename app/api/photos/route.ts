import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

type Photo = { thumb: string; full: string };

type PhotoGroup = {
  key: string;
  title: string;
  date: string;
  photos: Photo[];
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

// ── Cloudinary fetch-based delivery ──────────────────────────────────────
// The recap-photos bucket is public, so we hand Cloudinary the stable public
// URL of each original and let it fetch, resize, re-encode (WebP/AVIF via
// f_auto) and CDN-cache the result. Originals stay in Supabase — nothing is
// migrated, and the capture form (a separate repo) keeps writing there.
//
// Grid thumbnails are ~20-40 KB vs the ~3 MB originals; the lightbox gets a
// still-optimized 1600px version instead of the raw multi-MB file.
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'activation';
const THUMB_TX = 'f_auto,q_auto,w_400,c_limit';
const FULL_TX = 'f_auto,q_auto,w_1600,c_limit';

function cloudinaryFetch(publicUrl: string, transform: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transform}/${encodeURIComponent(publicUrl)}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const client = searchParams.get('client');
  if (!client) {
    return NextResponse.json({ error: 'client param required' }, { status: 400 });
  }

  const storageFolder = STORAGE_SLUG[client] ?? client;

  // Photos live under two conventions in the recap-photos bucket:
  //   1. legacy:  {client}/{category}/file          (e.g. 3chi, mellow_fellow, older amigos)
  //   2. current: brand-images/{client}/{category}/file  (what the app writes today)
  // Read both bases and merge so every client shows all of its photos.
  const baseFolders = [storageFolder, `brand-images/${storageFolder}`];

  // Accumulate storage paths per category (engagement/setup/shelf) across both bases.
  const categoryPaths: Record<string, string[]> = {};

  for (const base of baseFolders) {
    const { data: items, error } = await supabase.storage
      .from('recap-photos')
      .list(base, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

    // A missing base folder just means no photos under that convention — skip it.
    if (error || !items || items.length === 0) continue;

    type StorageItem = (typeof items)[number];
    const typeFolders = items.filter((item: StorageItem) => !item.id || item.metadata === null);

    for (const folder of typeFolders) {
      if (folder.name.startsWith('.')) continue;

      const { data: files } = await supabase.storage
        .from('recap-photos')
        .list(`${base}/${folder.name}`, { limit: 200 });

      const filePaths = (files ?? [])
        .filter((f: StorageItem) => {
          const size = (f.metadata as Record<string, unknown> | null)?.['size'] as number | undefined;
          return size && size > 0 && !f.name.startsWith('.');
        })
        .map((f: StorageItem) => `${base}/${folder.name}/${f.name}`);

      if (filePaths.length === 0) continue;

      (categoryPaths[folder.name] ??= []).push(...filePaths);
    }
  }

  const groups: PhotoGroup[] = [];

  for (const [category, filePaths] of Object.entries(categoryPaths)) {
    const photos: Photo[] = filePaths.map(path => {
      const publicUrl = supabase.storage.from('recap-photos').getPublicUrl(path).data.publicUrl;
      return {
        thumb: cloudinaryFetch(publicUrl, THUMB_TX),
        full: cloudinaryFetch(publicUrl, FULL_TX),
      };
    });

    if (photos.length === 0) continue;

    groups.push({
      key: category,
      title: TYPE_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1),
      date: '',
      photos,
    });
  }

  if (groups.length === 0) {
    return NextResponse.json({ events: [] });
  }

  // Order: engagement → shelf → setup
  const ORDER = ['engagement', 'shelf', 'setup'];
  groups.sort(
    (a, b) => (ORDER.indexOf(a.key) === -1 ? 99 : ORDER.indexOf(a.key)) -
               (ORDER.indexOf(b.key) === -1 ? 99 : ORDER.indexOf(b.key))
  );

  return NextResponse.json({ events: groups });
}

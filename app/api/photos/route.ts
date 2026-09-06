import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

type Photo = { thumb: string; full: string; uploadedAt: string };

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

// Auto-upload mapping: a Cloudinary console setting maps the folder prefix below
// to the Supabase brand-images base URL. Delivering an upload-type URL whose
// public_id is `${MAPPING_FOLDER}/{brand}/{category}/{file}` makes Cloudinary
// lazily fetch the original from Supabase AND store it in that brand folder,
// so the media library is organized by brand and stays in sync as the capture
// form (separate repo) adds new photos. Configure in Cloudinary:
//   Settings > Upload > Auto upload mapping
//     Folder:     greenline
//     URL prefix: https://<project>.supabase.co/storage/v1/object/public/recap-photos/brand-images/
const MAPPING_FOLDER = process.env.CLOUDINARY_MAPPING_FOLDER || 'greenline';

// Encode each path segment (handles spaces etc.) while preserving the slashes.
function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

// Fetch delivery — Cloudinary pulls the remote URL on demand (no folder).
function cloudinaryFetch(publicUrl: string, transform: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transform}/${encodeURIComponent(publicUrl)}`;
}

// Cloudinary's free plan rejects source images larger than 10 MB (both fetch
// and upload delivery return 400). Serve those straight from Supabase so they
// still render — unoptimized, but not broken.
const CLOUDINARY_MAX_BYTES = 10 * 1024 * 1024;

// Build the delivery URL for a storage path. Images under brand-images/ are
// delivered via the brand-foldered auto-upload mapping; anything else falls
// back to fetch so it still renders. Files over Cloudinary's size limit are
// served directly from Supabase.
function deliver(storagePath: string, transform: string, size: number): string {
  const publicUrl = supabase.storage.from('recap-photos').getPublicUrl(storagePath).data.publicUrl;
  if (size > CLOUDINARY_MAX_BYTES) return publicUrl;

  const BRAND_PREFIX = 'brand-images/';
  if (storagePath.startsWith(BRAND_PREFIX)) {
    // brand-images/{brand}/{category}/{file}  ->  greenline/{brand}/{category}/{file}
    const publicId = `${MAPPING_FOLDER}/${storagePath.slice(BRAND_PREFIX.length)}`;
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${encodePath(publicId)}`;
  }
  return cloudinaryFetch(publicUrl, transform);
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

  // Accumulate storage paths (with byte size, content etag, and upload time) per
  // category across both bases.
  const categoryPaths: Record<string, { path: string; size: number; etag: string; createdAt: string }[]> = {};

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
        .map((f: StorageItem) => {
          const metadata = f.metadata as Record<string, unknown> | null;
          return {
            path: `${base}/${folder.name}/${f.name}`,
            size: (metadata?.['size'] as number) ?? 0,
            etag: (metadata?.['eTag'] as string) ?? '',
            createdAt: (f as unknown as { created_at?: string }).created_at ?? '',
          };
        });

      if (filePaths.length === 0) continue;

      (categoryPaths[folder.name] ??= []).push(...filePaths);
    }
  }

  const groups: PhotoGroup[] = [];

  for (const [category, filePaths] of Object.entries(categoryPaths)) {
    // De-dupe exact-duplicate uploads (e.g. the same photo present under both the
    // legacy and brand-images storage conventions) by content identity — an
    // object's etag is a hash of its bytes, so two entries sharing one mean the
    // same image regardless of filename/path. Fall back to the path itself for
    // the rare file with no etag.
    const seen = new Set<string>();
    const deduped = filePaths.filter(({ path, size, etag }) => {
      const key = etag ? `${etag}:${size}` : path;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Newest upload first by default; the client can flip this to ascending.
    deduped.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const photos: Photo[] = deduped.map(({ path, size, createdAt }) => ({
      thumb: deliver(path, THUMB_TX, size),
      full: deliver(path, FULL_TX, size),
      uploadedAt: createdAt,
    }));

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

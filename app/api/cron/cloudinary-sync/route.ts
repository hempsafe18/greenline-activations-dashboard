import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

// Recurring push (Vercel Cron -> vercel.json) that actively uploads new recap
// photos into Cloudinary's greenline/{brand}/{category}/ folders, instead of
// relying on someone opening a Market Intel gallery to trigger Cloudinary's
// lazy auto-upload-mapping fetch (see app/api/photos/route.ts `deliver()`).
// Photos also feed social media planning, so they need to land in Cloudinary
// on a schedule, not only when a dashboard page happens to be viewed.

export const maxDuration = 60;

const BUCKET = 'recap-photos';
const BRAND_PREFIX = 'brand-images/';
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'activation';
const MAPPING_FOLDER = process.env.CLOUDINARY_MAPPING_FOLDER || 'greenline';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Matches the free-plan source size limit enforced in app/api/photos/route.ts —
// those files are served straight from Supabase and never organized in Cloudinary.
const CLOUDINARY_MAX_BYTES = 10 * 1024 * 1024;

// Kept small enough that a sequential batch finishes within Vercel's default
// function time limit even on the Hobby plan; the 15-min cron cadence makes
// up the throughput (backlog clears over a few runs, not all in one).
const BATCH_SIZE = 30;

type StorageObject = { name: string; updated_at: string; metadata: { size?: number } | null };

async function signParams(params: Record<string, string>): Promise<string> {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  const digest = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(`${toSign}${CLOUDINARY_API_SECRET}`)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Push one storage object into Cloudinary under the same public_id convention
// deliver() already reads from (brand-images/{brand}/{category}/{file} ->
// greenline/{brand}/{category}/{file}). overwrite:false makes re-processing a
// path a cheap no-op instead of re-fetching an asset Cloudinary already has.
async function pushToCloudinary(storagePath: string): Promise<void> {
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
  const relativePath = storagePath.slice(BRAND_PREFIX.length).replace(/\.[^./]+$/, '');
  const publicId = `${MAPPING_FOLDER}/${relativePath}`;
  const [brand, category] = storagePath.slice(BRAND_PREFIX.length).split('/');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams: Record<string, string> = {
    overwrite: 'false',
    public_id: publicId,
    tags: `brand:${brand},category:${category},source:recap`,
    timestamp,
  };
  const signature = await signParams(signedParams);

  const form = new FormData();
  form.set('file', publicUrl);
  form.set('api_key', CLOUDINARY_API_KEY!);
  form.set('timestamp', timestamp);
  form.set('signature', signature);
  for (const [key, value] of Object.entries(signedParams)) {
    if (key !== 'timestamp') form.set(key, value);
  }

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudinary upload failed for ${storagePath}: ${res.status} ${body}`);
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return NextResponse.json({ error: 'CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET not configured' }, { status: 500 });
  }

  const { data: state, error: stateError } = await supabase
    .from('cloudinary_sync_state')
    .select('last_synced_at')
    .eq('id', 1)
    .single();

  if (stateError) {
    return NextResponse.json({ error: `Failed to read sync state: ${stateError.message}` }, { status: 500 });
  }

  const since = state.last_synced_at;

  const { data: objects, error: listError } = await supabase
    .schema('storage')
    .from('objects')
    .select('name, updated_at, metadata')
    .eq('bucket_id', BUCKET)
    .like('name', `${BRAND_PREFIX}%`)
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE)
    .returns<StorageObject[]>();

  if (listError) {
    return NextResponse.json({ error: `Failed to list new photos: ${listError.message}` }, { status: 500 });
  }

  if (!objects || objects.length === 0) {
    return NextResponse.json({ pushed: 0, skipped: 0, failed: 0, message: 'up to date' });
  }

  let pushed = 0;
  let skipped = 0;
  let failed = 0;

  for (const obj of objects) {
    const size = obj.metadata?.size ?? 0;
    if (size > CLOUDINARY_MAX_BYTES) {
      skipped++;
      continue;
    }
    try {
      await pushToCloudinary(obj.name);
      pushed++;
    } catch (err) {
      failed++;
      console.error(err);
    }
  }

  const newestSynced = objects[objects.length - 1].updated_at;
  const { error: updateError } = await supabase
    .from('cloudinary_sync_state')
    .update({ last_synced_at: newestSynced, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (updateError) {
    return NextResponse.json({ error: `Failed to advance sync cursor: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    pushed,
    skipped,
    failed,
    processed: objects.length,
    remaining: objects.length === BATCH_SIZE,
    newestSynced,
  });
}

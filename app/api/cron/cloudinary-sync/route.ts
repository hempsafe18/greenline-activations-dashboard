import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

// Recurring push (Vercel Cron -> vercel.json) that actively uploads new recap
// photos into Cloudinary's greenline/{brand}/{category}/ folders, instead of
// relying on someone opening a Market Intel gallery to trigger Cloudinary's
// lazy auto-upload-mapping fetch (see app/api/photos/route.ts `deliver()`).
// Photos also feed social media planning, so they need to land in Cloudinary
// on a schedule, not only when a dashboard page happens to be viewed.
//
// Runs weekly (Sunday 23:59 ET, once recaps for the week are confirmed
// submitted), so a single run has to clear a full week's worth of photos —
// it pages through everything since the last sync and uploads with bounded
// concurrency, advancing the cursor after each page so a timeout still keeps
// whatever progress was made instead of redoing it next week.
//
// Requires a paid Vercel plan (Hobby caps function duration at 60s, which a
// week's backlog can exceed even with concurrency).

export const maxDuration = 300;

const BUCKET = 'recap-photos';
const BRAND_PREFIX = 'brand-images/';
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'activation';
const MAPPING_FOLDER = process.env.CLOUDINARY_MAPPING_FOLDER || 'greenline';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Matches the free-plan source size limit enforced in app/api/photos/route.ts —
// those files are served straight from Supabase and never organized in Cloudinary.
const CLOUDINARY_MAX_BYTES = 10 * 1024 * 1024;

const PAGE_SIZE = 50;
const UPLOAD_CONCURRENCY = 8;
// Stop pulling new pages once this much of maxDuration has elapsed, leaving
// room to finish in-flight uploads and write the cursor before Vercel kills it.
const TIME_BUDGET_MS = (maxDuration - 30) * 1000;

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

// Runs a batch with at most `concurrency` uploads in flight at once.
async function pushBatch(objects: StorageObject[]): Promise<{ pushed: number; skipped: number; failed: number }> {
  let pushed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < objects.length; i += UPLOAD_CONCURRENCY) {
    const chunk = objects.slice(i, i + UPLOAD_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((obj) => {
        const size = obj.metadata?.size ?? 0;
        if (size > CLOUDINARY_MAX_BYTES) return Promise.resolve('skipped' as const);
        return pushToCloudinary(obj.name).then(() => 'pushed' as const);
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value === 'pushed') pushed++;
        else skipped++;
      } else {
        failed++;
        console.error(result.reason);
      }
    }
  }

  return { pushed, skipped, failed };
}

export async function GET(req: Request) {
  const startedAt = Date.now();

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

  let since = state.last_synced_at;
  let pushed = 0;
  let skipped = 0;
  let failed = 0;
  let pagesProcessed = 0;
  let timedOut = false;

  while (true) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }

    const { data: objects, error: listError } = await supabase
      .schema('storage')
      .from('objects')
      .select('name, updated_at, metadata')
      .eq('bucket_id', BUCKET)
      .like('name', `${BRAND_PREFIX}%`)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(PAGE_SIZE)
      .returns<StorageObject[]>();

    if (listError) {
      return NextResponse.json({ error: `Failed to list new photos: ${listError.message}`, pushed, skipped, failed }, { status: 500 });
    }
    if (!objects || objects.length === 0) break;

    const result = await pushBatch(objects);
    pushed += result.pushed;
    skipped += result.skipped;
    failed += result.failed;
    pagesProcessed++;

    since = objects[objects.length - 1].updated_at;

    const { error: updateError } = await supabase
      .from('cloudinary_sync_state')
      .update({ last_synced_at: since, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (updateError) {
      return NextResponse.json({ error: `Failed to advance sync cursor: ${updateError.message}`, pushed, skipped, failed }, { status: 500 });
    }

    if (objects.length < PAGE_SIZE) break;
  }

  return NextResponse.json({
    pushed,
    skipped,
    failed,
    pagesProcessed,
    timedOut,
    newestSynced: since,
    elapsedMs: Date.now() - startedAt,
  });
}

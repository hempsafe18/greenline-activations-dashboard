/**
 * One-time backfill: converts full public URLs stored in recaps.setup_photo,
 * recaps.shelf_photo, and recaps.engagement_photos into bare storage paths.
 *
 * Before: "https://<project>.supabase.co/storage/v1/object/public/recap-photos/amigos/setup/file.jpg"
 * After:  "amigos/setup/file.jpg"
 *
 * Rows already storing a bare path (no "http" prefix) are skipped.
 * Engagement photos are comma-separated — each URL in the list is converted.
 *
 * Usage:
 *   node scripts/backfill-photo-paths.mjs            # dry run — prints plan, changes nothing
 *   node scripts/backfill-photo-paths.mjs --execute  # applies updates to the database
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error('ERROR: .env.local not found at', envPath);
    process.exit(1);
  }
  const lines = readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_KEY = env['SUPABASE_SECRET_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = !process.argv.includes('--execute');

// The prefix to strip from every stored URL
const PUBLIC_URL_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/recap-photos/`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a single value (which may be a public URL or already a path)
 * into a bare storage path.  Returns null if the value is empty or
 * already looks like a path.
 */
function urlToPath(value) {
  if (!value || !value.trim()) return null;
  const v = value.trim();
  if (!v.startsWith('http')) return null; // already a path — skip
  if (!v.startsWith(PUBLIC_URL_PREFIX)) {
    // URL from a different project / bucket — log but don't corrupt
    return { error: `Unexpected URL prefix: ${v}` };
  }
  // Strip prefix and URL-decode (handles spaces → %20, etc.)
  return decodeURIComponent(v.slice(PUBLIC_URL_PREFIX.length));
}

/**
 * Convert a comma-separated list of URLs to a comma-separated list of paths.
 * Returns { converted, unchanged, errors } counts and the new string value.
 */
function convertPhotoField(raw) {
  if (!raw || !raw.trim()) return { newValue: raw, converted: 0, unchanged: 0, errors: [] };

  const entries = raw.split(',').map(s => s.trim()).filter(Boolean);
  const out = [];
  let converted = 0, unchanged = 0;
  const errors = [];

  for (const entry of entries) {
    const result = urlToPath(entry);
    if (result === null) {
      out.push(entry);   // already a path
      unchanged++;
    } else if (result?.error) {
      out.push(entry);   // keep as-is, log error
      errors.push(result.error);
    } else {
      out.push(result);  // converted URL → path
      converted++;
    }
  }

  return { newValue: out.join(', '), converted, unchanged, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(DRY_RUN
    ? '\n🔍  DRY RUN — pass --execute to apply changes\n'
    : '\n🚀  EXECUTING BACKFILL\n');

  // Fetch all recap rows that have any photo field populated
  const { data: recaps, error: recapErr } = await supabase
    .from('recaps')
    .select('id, brand_name, store_name, activation_date, setup_photo, shelf_photo, engagement_photos')
    .or('setup_photo.neq.,shelf_photo.neq.,engagement_photos.neq.')
    .order('activation_date', { ascending: true });

  if (recapErr) throw new Error(`recaps query failed: ${recapErr.message}`);
  console.log(`Found ${recaps.length} recap(s) with photo fields.\n`);

  let needsUpdate = 0, totalConverted = 0, totalErrors = 0, updated = 0, failed = 0;

  for (const recap of recaps) {
    const setup   = convertPhotoField(recap.setup_photo);
    const shelf   = convertPhotoField(recap.shelf_photo);
    const engage  = convertPhotoField(recap.engagement_photos);

    const anyConverted = setup.converted + shelf.converted + engage.converted;
    const anyErrors    = [...setup.errors, ...shelf.errors, ...engage.errors];

    if (anyErrors.length > 0) {
      console.warn(`  ⚠️  ID ${recap.id} (${recap.brand_name} / ${recap.store_name} / ${recap.activation_date})`);
      anyErrors.forEach(e => console.warn(`       ${e}`));
    }

    if (anyConverted === 0) continue; // nothing to do for this row

    needsUpdate++;
    totalConverted += anyConverted;
    totalErrors    += anyErrors.length;

    console.log(`  ${DRY_RUN ? 'WOULD UPDATE' : 'UPDATE'} ID ${recap.id}  (${recap.brand_name} / ${recap.store_name} / ${recap.activation_date})`);
    if (setup.converted)  console.log(`    setup_photo:        ${recap.setup_photo}\n                    →   ${setup.newValue}`);
    if (shelf.converted)  console.log(`    shelf_photo:        ${recap.shelf_photo}\n                    →   ${shelf.newValue}`);
    if (engage.converted) console.log(`    engagement_photos:  ${recap.engagement_photos}\n                    →   ${engage.newValue}`);
    console.log();

    if (!DRY_RUN) {
      const patch = {};
      if (setup.converted)  patch.setup_photo        = setup.newValue;
      if (shelf.converted)  patch.shelf_photo        = shelf.newValue;
      if (engage.converted) patch.engagement_photos  = engage.newValue;

      const { error: updateErr } = await supabase
        .from('recaps')
        .update(patch)
        .eq('id', recap.id);

      if (updateErr) {
        console.error(`  ❌  Failed to update ID ${recap.id}: ${updateErr.message}`);
        failed++;
      } else {
        updated++;
      }
    }
  }

  console.log('─'.repeat(60));
  console.log(`Recaps scanned:       ${recaps.length}`);
  console.log(`Recaps needing update:${needsUpdate}`);
  console.log(`URLs converted:       ${totalConverted}`);
  if (totalErrors > 0) console.warn(`Unexpected URLs:      ${totalErrors}  ← review warnings above`);

  if (!DRY_RUN) {
    console.log(`\nRows updated:         ${updated}`);
    if (failed > 0) console.error(`Rows failed:          ${failed}`);
  } else {
    console.log(`\nDry run complete. Run with --execute to apply ${needsUpdate} update(s).`);
  }
}

main().catch(err => {
  console.error('\n❌  Backfill error:', err.message);
  process.exit(1);
});

/**
 * One-time migration: moves legacy type-folder photos to client/event folder structure.
 *
 * Legacy layout:  recap-photos/shelf/{RepName}_{timestamp}_{hash}.jpeg
 * New layout:     recap-photos/{client-slug}/{YYYY-MM-DD}_{store-slug}/{type}-{n}.jpeg
 *
 * Matching logic: extract the upload timestamp from the filename, then find the
 * recap row whose submitted_at is within 48 hours of that timestamp. If a match
 * is found the file is moved; if not it is logged and left in place.
 *
 * Usage:
 *   node scripts/migrate-storage.mjs            # dry run (prints plan, moves nothing)
 *   node scripts/migrate-storage.mjs --execute  # performs the moves + deletes placeholders
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
const BUCKET = 'recap-photos';
const DRY_RUN = !process.argv.includes('--execute');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Slugify a store name: "Total Wine #805" → "total-wine-805" */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')   // non-alphanumeric runs → single dash
    .replace(/^-|-$/g, '');         // trim leading/trailing dashes
}

/** Slugify a brand name to a folder name: "Amigos" → "amigos", "3CHI" → "3chi" */
function clientSlug(brand) {
  return brand.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
}

/** Extract ISO timestamp from filename: "Maryam_Kosoko_2026-05-23T00-45-41-269Z_hash.jpeg"
 *  The pattern is: anything_YYYY-MM-DDTHH-MM-SS-mmmZ_hash.ext
 */
function parseTimestampFromName(name) {
  const match = name.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)_/);
  if (!match) return null;
  // Convert dashes-in-time back to colons: "00-45-41-269Z" → "00:45:41.269Z"
  const raw = match[1]; // "2026-05-23T00-45-41-269Z"
  const [datePart, timePart] = raw.split('T');
  const timeFixed = timePart
    .replace(/^(\d{2})-(\d{2})-(\d{2})-(\d+)Z$/, '$1:$2:$3.$4Z');
  return new Date(`${datePart}T${timeFixed}`);
}

/** Find the best matching recap for a given upload timestamp (within 48 h window) */
function findBestRecap(uploadTime, recaps) {
  const WINDOW_MS = 48 * 60 * 60 * 1000;
  let best = null;
  let bestDelta = Infinity;

  for (const recap of recaps) {
    const submitted = new Date(recap.submitted_at);
    const delta = Math.abs(submitted - uploadTime);
    if (delta < WINDOW_MS && delta < bestDelta) {
      best = recap;
      bestDelta = delta;
    }
  }
  return best;
}

/** List all files recursively under a folder prefix */
async function listAllFiles(prefix) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(`list("${prefix}") failed: ${error.message}`);
  const results = [];
  for (const item of data || []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.id && item.metadata === null) {
      // It's a folder — recurse
      const children = await listAllFiles(fullPath);
      results.push(...children);
    } else {
      results.push({ path: fullPath, name: item.name, size: item.metadata?.size ?? 0 });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(DRY_RUN ? '\n🔍  DRY RUN — pass --execute to apply changes\n' : '\n🚀  EXECUTING MIGRATION\n');

  // 1. Fetch all recaps with real data
  const { data: recaps, error: recapErr } = await supabase
    .from('recaps')
    .select('id, brand_name, store_name, activation_date, submitted_at')
    .neq('brand_name', '')
    .neq('store_name', '')
    .order('submitted_at', { ascending: false });

  if (recapErr) throw new Error(`recaps query failed: ${recapErr.message}`);
  console.log(`Found ${recaps.length} recap(s) in database.\n`);

  // 2. Collect legacy type-folder files (shelf/, engagement/, setup/)
  const LEGACY_TYPES = ['shelf', 'engagement', 'setup'];
  const legacyFiles = [];

  for (const type of LEGACY_TYPES) {
    const files = await listAllFiles(type);
    for (const f of files) {
      if (f.name.startsWith('.') || f.size === 0) continue; // skip placeholders
      legacyFiles.push({ ...f, photoType: type });
    }
  }

  if (legacyFiles.length === 0) {
    console.log('✅  No legacy files found — nothing to migrate.');
    return;
  }

  console.log(`Found ${legacyFiles.length} legacy file(s) to migrate:\n`);

  // 3. Build migration plan
  const plan = [];    // { from, to, matched }
  const unmatched = [];
  const typeCounters = {}; // track per-event per-type counter for numbering

  for (const file of legacyFiles) {
    const uploadTime = parseTimestampFromName(file.name);
    const recap = uploadTime ? findBestRecap(uploadTime, recaps) : null;

    if (!recap) {
      unmatched.push(file);
      continue;
    }

    const slug = clientSlug(recap.brand_name);
    const storeSlug = slugify(recap.store_name);
    const eventKey = `${slug}/${recap.activation_date}_${storeSlug}`;
    const counterKey = `${eventKey}/${file.photoType}`;
    typeCounters[counterKey] = (typeCounters[counterKey] || 0) + 1;
    const n = typeCounters[counterKey];
    const ext = file.name.split('.').pop() || 'jpeg';
    const toPath = `${eventKey}/${file.photoType}-${n}.${ext}`;

    plan.push({ from: file.path, to: toPath, recap });
  }

  // 4. Print plan
  for (const { from, to, recap } of plan) {
    console.log(`  MOVE  ${from}`);
    console.log(`    →   ${to}`);
    console.log(`  (matched recap: ${recap.brand_name} / ${recap.store_name} / ${recap.activation_date})\n`);
  }

  if (unmatched.length > 0) {
    console.log('⚠️  The following files could not be matched to any recap and will be left in place:');
    for (const f of unmatched) console.log(`    ${f.path}`);
    console.log();
  }

  if (DRY_RUN) {
    console.log(`Dry run complete. Run with --execute to apply ${plan.length} move(s).`);
    return;
  }

  // 5. Execute moves
  let moved = 0;
  let failed = 0;
  for (const { from, to } of plan) {
    const { error } = await supabase.storage.from(BUCKET).move(from, to);
    if (error) {
      console.error(`  ❌  FAILED to move ${from}: ${error.message}`);
      failed++;
    } else {
      console.log(`  ✅  Moved: ${from} → ${to}`);
      moved++;
    }
  }

  // 6. Remove placeholder files
  const placeholderPaths = [
    'engagement/.emptyFolderPlaceholder',
    'setup/.emptyFolderPlaceholder',
    'setup/Untitled folder/.emptyFolderPlaceholder',
  ];

  for (const p of placeholderPaths) {
    const { error } = await supabase.storage.from(BUCKET).remove([p]);
    if (!error) console.log(`  🗑️   Removed placeholder: ${p}`);
  }

  console.log(`\n✅  Migration complete: ${moved} moved, ${failed} failed, ${unmatched.length} unmatched.`);
}

main().catch(err => {
  console.error('\n❌  Migration error:', err.message);
  process.exit(1);
});

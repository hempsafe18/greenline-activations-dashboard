/**
 * One-time migration: moves legacy root-level type-folder photos into the
 * correct client/type folder structure.
 *
 * Legacy layout:  recap-photos/shelf/{filename}
 *                 recap-photos/engagement/{filename}
 *                 recap-photos/setup/{filename}
 *
 * New layout:     recap-photos/{client-folder}/{type}/{filename}
 *
 * Client folder names (must match Supabase Storage exactly):
 *   amigos        → amigos
 *   3chi          → 3chi
 *   mellow-fellow → mellow_fellow
 *
 * Matching logic: extract the upload timestamp from the filename, then find the
 * recap row whose submitted_at is within 48 hours. If a match is found the file
 * is moved; unmatched files are logged and left in place for manual review.
 *
 * Usage:
 *   node scripts/migrate-storage.mjs            # dry run (prints plan, moves nothing)
 *   node scripts/migrate-storage.mjs --execute  # performs the moves
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

// Storage folder name for each brand (must match exactly what's in the bucket)
const BRAND_TO_FOLDER = {
  'amigos':        'amigos',
  'Amigos':        'amigos',
  'AMIGOS':        'amigos',
  '3chi':          '3chi',
  '3CHI':          '3chi',
  'mellow fellow': 'mellow_fellow',
  'MELLOW FELLOW': 'mellow_fellow',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract ISO timestamp from legacy filenames: "RepName_2026-05-23T00-45-41-269Z_hash.jpeg" */
function parseTimestampFromName(name) {
  const match = name.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)_/);
  if (!match) return null;
  const raw = match[1];
  const [datePart, timePart] = raw.split('T');
  const timeFixed = timePart.replace(/^(\d{2})-(\d{2})-(\d{2})-(\d+)Z$/, '$1:$2:$3.$4Z');
  return new Date(`${datePart}T${timeFixed}`);
}

/** Find the best recap within a 48-hour window of the upload timestamp */
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

/** List all real files (non-placeholder) recursively under a prefix */
async function listAllFiles(prefix) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(`list("${prefix}") failed: ${error.message}`);
  const results = [];
  for (const item of data || []) {
    const fullPath = `${prefix}/${item.name}`;
    if (!item.id && item.metadata === null) {
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

  // 2. Collect files from legacy root-level type folders (not inside a client folder)
  const LEGACY_TYPES = ['shelf', 'engagement', 'setup'];
  const legacyFiles = [];

  for (const type of LEGACY_TYPES) {
    let files;
    try {
      files = await listAllFiles(type);
    } catch {
      // Folder doesn't exist — already cleaned up
      continue;
    }
    for (const f of files) {
      if (f.name.startsWith('.') || f.size === 0) continue;
      legacyFiles.push({ ...f, photoType: type });
    }
  }

  if (legacyFiles.length === 0) {
    console.log('✅  No legacy files found — nothing to migrate.');
    return;
  }

  console.log(`Found ${legacyFiles.length} legacy file(s) to migrate:\n`);

  // 3. Build migration plan — target: {client-folder}/{type}/{original-filename}
  const plan = [];
  const unmatched = [];

  for (const file of legacyFiles) {
    const uploadTime = parseTimestampFromName(file.name);
    const recap = uploadTime ? findBestRecap(uploadTime, recaps) : null;

    if (!recap) {
      unmatched.push(file);
      continue;
    }

    const clientFolder = BRAND_TO_FOLDER[recap.brand_name] ?? recap.brand_name.toLowerCase().replace(/\s+/g, '_');
    const toPath = `${clientFolder}/${file.photoType}/${file.name}`;

    plan.push({ from: file.path, to: toPath, recap });
  }

  // 4. Print plan
  for (const { from, to, recap } of plan) {
    console.log(`  MOVE  ${from}`);
    console.log(`    →   ${to}`);
    console.log(`  (matched: ${recap.brand_name} / ${recap.store_name} / ${recap.activation_date})\n`);
  }

  if (unmatched.length > 0) {
    console.log('⚠️  Could not match to a recap — left in place:');
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
      console.error(`  ❌  FAILED  ${from}: ${error.message}`);
      failed++;
    } else {
      console.log(`  ✅  Moved   ${from} → ${to}`);
      moved++;
    }
  }

  console.log(`\n✅  Migration complete: ${moved} moved, ${failed} failed, ${unmatched.length} unmatched.`);
}

main().catch(err => {
  console.error('\n❌  Migration error:', err.message);
  process.exit(1);
});

/**
 * Copies each ambassador's HubSpot application answers onto their `profiles`
 * row so /profiles can show them:
 *
 *   HubSpot "Brand Ambassador Experience" (brand_ambassador_experience) -> profiles.application_experience
 *   HubSpot "About"                       (about)                       -> profiles.application_bio
 *
 * Matches on email (case-insensitive) and only fills columns that are still
 * empty — it never overwrites a value someone already set or edited by hand.
 *
 * Usage:
 *   node scripts/sync-hubspot-applications.mjs            # dry run — prints plan, changes nothing
 *   node scripts/sync-hubspot-applications.mjs --execute  # applies updates to the database
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and HUBSPOT_ACCESS_TOKEN in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error('ERROR: .env.local not found at', envPath);
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_KEY = env['SUPABASE_SECRET_KEY'];
const HUBSPOT_TOKEN = env['HUBSPOT_ACCESS_TOKEN'];

if (!SUPABASE_URL || !SUPABASE_KEY || !HUBSPOT_TOKEN) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and HUBSPOT_ACCESS_TOKEN must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = !process.argv.includes('--execute');
const BATCH = 50; // HubSpot's IN filter accepts up to 100 values

const isEmpty = (v) => v == null || String(v).trim() === '';

async function fetchHubspotApplications(emails) {
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'IN', values: emails }] }],
      properties: ['email', 'brand_ambassador_experience', 'about'],
      limit: 100,
    }),
  });
  if (!res.ok) throw new Error(`HubSpot search failed: ${res.status} ${await res.text()}`);
  return (await res.json()).results ?? [];
}

const { data: profiles, error } = await supabase
  .from('profiles')
  .select('id, email, full_name, application_experience, application_bio')
  .eq('role', 'staff')
  .not('email', 'is', null);
if (error) throw error;

const needy = profiles.filter((p) => isEmpty(p.application_experience) || isEmpty(p.application_bio));
console.log(`${profiles.length} ambassadors, ${needy.length} missing an experience or about answer.`);

let updated = 0;
for (let i = 0; i < needy.length; i += BATCH) {
  const batch = needy.slice(i, i + BATCH);
  const contacts = await fetchHubspotApplications(batch.map((p) => p.email.toLowerCase()));
  const byEmail = new Map(contacts.map((c) => [c.properties.email?.toLowerCase(), c.properties]));

  for (const p of batch) {
    const hs = byEmail.get(p.email.toLowerCase());
    if (!hs) continue;
    const patch = {};
    if (isEmpty(p.application_experience) && !isEmpty(hs.brand_ambassador_experience)) {
      patch.application_experience = hs.brand_ambassador_experience.trim();
    }
    if (isEmpty(p.application_bio) && !isEmpty(hs.about)) {
      patch.application_bio = hs.about.trim();
    }
    if (Object.keys(patch).length === 0) continue;

    console.log(`${DRY_RUN ? '[dry run] ' : ''}${p.full_name}: ${Object.keys(patch).join(', ')}`);
    if (!DRY_RUN) {
      const { error: updErr } = await supabase.from('profiles').update(patch).eq('id', p.id);
      if (updErr) {
        console.error(`  FAILED: ${updErr.message}`);
        continue;
      }
    }
    updated++;
  }
}

console.log(`\n${DRY_RUN ? 'Would update' : 'Updated'} ${updated} profiles.${DRY_RUN ? ' Re-run with --execute to apply.' : ''}`);

# Greenline Activations Dashboard

Next.js (App Router) dashboard for Greenline Activations — client brand dashboards, the GROW sales portal, and the ambassador profile directory.

## Ambassador Profiles (`/profiles`)

A client-facing directory of brand ambassadors, backed by Supabase and Cloudinary.

- `/profiles` — directory grid of active ambassadors (search, market filter, HempSafe-certified toggle). Requires Greenline admin login (Clerk), gated to the emails in `ADMIN_EMAILS` in `app/profiles/page.tsx`.
- `/profiles/[id]` — a single ambassador's profile. Publicly accessible with no login — this is the link you share with a client ahead of an event. It never shows phone, email, or any other contact info.

### Adding / Updating Ambassadors

Ambassador records live in the `ambassadors` table in Supabase (project `qqkbopkyfgiqsrrtvxzv`). To add or edit one:

1. Open the [Supabase dashboard](https://supabase.com/dashboard/project/qqkbopkyfgiqsrrtvxzv) → **Table Editor** → `ambassadors`.
2. Insert a new row (or edit an existing one) with:
   - `name` — full name as it should appear to clients.
   - `headshot_url` — a Cloudinary delivery URL (see below). Leave blank to show an initials avatar instead.
   - `strengths` — a text array of 2–3 short bullet lines pulled from their application (e.g. `{"5+ years event sampling experience","Bilingual EN/ES","Retail merchandising background"}`).
   - `markets` — a text array of markets they work, formatted `"City, ST"` (e.g. `{"Jacksonville, FL","Miami, FL"}`).
   - `hempsafe_certified` — `true`/`false`.
   - `hempsafe_cert_date` — the date they were certified (only shown if `hempsafe_certified` is `true`).
   - `status` — `active` to show them in the directory, `inactive` to hide them (their old profile link will 404).
3. Changes appear immediately — there's no rebuild or redeploy needed.

The initial seed (`supabase/migrations/20260720_seed_ambassadors.sql`) was pulled from the HubSpot ambassador pipeline (contacts with `category = Ambassador` and `hempsafe_certified = true`). Names, markets, and cert dates came from HubSpot; `strengths` and `headshot_url` were left blank because HubSpot has no bio/photo data for these contacts — those need to be filled in per ambassador from their actual application/resume.

### Headshots via Cloudinary

Headshots are served from Cloudinary (cloud name `activation`):

1. Upload the photo to the `activation` Cloudinary account.
2. Build a face-cropped delivery URL — either paste one directly, or use the helper in `lib/cloudinary.ts`:
   ```ts
   cloudinaryHeadshotUrl("folder/public_id") // → https://res.cloudinary.com/activation/image/upload/c_fill,g_face,w_400,h_400,q_auto,f_auto/folder/public_id
   ```
3. Paste the resulting URL into `headshot_url` for that ambassador.

If `headshot_url` is missing or fails to load, the profile falls back to a rounded initials avatar automatically — no broken images.

### Environment Variables

See `.env.example`. The profiles feature needs:

- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY` — Supabase project + service role key (data is read server-side).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth, gates `/profiles` (not `/profiles/[id]`).
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — defaults to `activation`; only needed if you use `cloudinaryHeadshotUrl()`.

### Migrations

Apply `supabase/migrations/20260720_create_ambassadors_table.sql` then `supabase/migrations/20260720_seed_ambassadors.sql` to the Supabase project (via the SQL editor, the Supabase CLI, or MCP `apply_migration`).

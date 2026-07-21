# Greenline Activations Dashboard

Next.js (App Router) dashboard for Greenline Activations — client brand dashboards, the GROW sales portal, and the ambassador profile directory.

## Ambassador Profiles (`/profiles`)

A client-facing directory of brand ambassadors, backed by Supabase.

- `/profiles` — directory grid of active ambassadors (search, market filter, HempSafe-certified toggle). Requires Greenline admin login (Clerk), gated to the emails in `ADMIN_EMAILS` in `app/profiles/page.tsx`.
- `/profiles/[id]` — a single ambassador's profile. Publicly accessible with no login — this is the link you share with a client ahead of an event. It never shows phone, email, or any other contact info.

Ambassador data is **not** a separate table — it's read directly from the existing `profiles` table (the same one the ambassador portal itself uses), filtered to `role = 'staff'`. That means every ambassador who signs up through the portal automatically shows up here; there's no separate roster to keep in sync. A migration (`supabase/migrations/20260721_add_ambassador_directory_columns.sql`) adds four columns this directory needs that the portal didn't already have: `markets`, `strengths`, `hempsafe_cert_date`, and `status` — it's purely additive and doesn't touch any existing column, data, or RLS policy on `profiles`.

### Adding / Updating Ambassadors

To edit what a client sees for a given ambassador:

1. Open the [Supabase dashboard](https://supabase.com/dashboard/project/qqkbopkyfgiqsrrtvxzv) → **Table Editor** → `profiles`.
2. Find the ambassador by `full_name` and edit:
   - `markets` — a text array of markets they work, formatted `"City, ST"` (e.g. `{"Jacksonville, FL","Miami, FL"}`). Backfilled once from their existing `city` field; edit for anyone who works multiple markets.
   - `strengths` — a text array of 2–3 short bullet lines pulled from their actual application (e.g. `{"5+ years event sampling experience","Bilingual EN/ES","Retail merchandising background"}`). Not populated automatically — there's no structured field for this in the portal today, so it has to be read off each ambassador's application/resume.
   - `hempsafe_cert_date` — the date they were certified (only shown if `hempsafe_certified` is `true`). Not backfilled; add it when known.
   - `status` — `active` to show them in the directory, `inactive` to hide them (their profile link will 404). Defaults to `active` for everyone.
3. `full_name`, `avatar_url`, and `hempsafe_certified` already come from the ambassador portal itself — don't duplicate them here, edit them at the source if they're wrong.
4. Changes appear immediately — there's no rebuild or redeploy needed.

### Headshots

Headshots render straight from each ambassador's existing `avatar_url` (uploaded through the portal, hosted on Supabase Storage) — no extra step needed for most ambassadors. If `avatar_url` is missing or fails to load, the profile falls back to a rounded initials avatar automatically.

If you'd rather host a specific photo on Cloudinary instead (cloud name `activation`), `lib/cloudinary.ts` has a helper to build a face-cropped delivery URL:

```ts
cloudinaryHeadshotUrl("folder/public_id") // → https://res.cloudinary.com/activation/image/upload/c_fill,g_face,w_400,h_400,q_auto,f_auto/folder/public_id
```

Paste the resulting URL into that ambassador's `avatar_url` — the directory doesn't care which host it came from.

### Environment Variables

See `.env.example`. The profiles feature needs:

- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY` — Supabase project + service role key (data is read server-side).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth, gates `/profiles` (not `/profiles/[id]`).
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — defaults to `activation`; only needed if you use `cloudinaryHeadshotUrl()`.

### Migrations

Apply `supabase/migrations/20260721_add_ambassador_directory_columns.sql` to the Supabase project (via the SQL editor, the Supabase CLI, or MCP `apply_migration`).

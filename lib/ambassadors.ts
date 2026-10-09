import { supabase } from "./supabase";
import { MIN_SAMPLED_FOR_RATE, type Ambassador, type AmbassadorPerformance } from "./ambassador-format";

export type { Ambassador, AmbassadorPerformance } from "./ambassador-format";

// Ambassador data lives in the existing ambassador-portal `profiles` table
// (role='staff' distinguishes ambassadors from portal admins). Only the
// columns the directory actually renders are selected — never phone, email,
// street_address, zip_code, or tracking_number.
// Only HempSafe-certified ambassadors are shown to brand managers.
const AMBASSADOR_COLUMNS =
  "id, slug, name:full_name, headshot_url:avatar_url, strengths, markets, state, city, hempsafe_certified, hempsafe_cert_date, experience:application_experience, about:application_bio, status, created_at";

type AmbassadorRow = Omit<Ambassador, "has_photo" | "performance">;

const EMPTY_PERFORMANCE: AmbassadorPerformance = { recaps: 0, sampled: 0, sold: 0, conversion_pct: null };

function toAmbassador(row: AmbassadorRow, performance?: AmbassadorPerformance): Ambassador {
  const headshot = row.headshot_url?.trim() || null;
  return {
    ...row,
    headshot_url: headshot,
    has_photo: !!headshot,
    strengths: row.strengths ?? [],
    markets: row.markets ?? [],
    experience: row.experience?.trim() || null,
    about: row.about?.trim() || null,
    performance: performance ?? EMPTY_PERFORMANCE,
  };
}

/**
 * Per-ambassador sampling performance, aggregated from the `recaps` table
 * (the same source as the portal's "Avg. Conversion Rate": units sold ÷
 * consumers sampled, summed across every submitted recap).
 */
async function getPerformanceByUser(userIds: string[]): Promise<Map<string, AmbassadorPerformance>> {
  const totals = new Map<string, { recaps: number; sampled: number; sold: number }>();
  if (userIds.length === 0) return new Map();

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("recaps")
      .select("user_id, consumers_sampled, estimated_units_sold")
      .in("user_id", userIds)
      .order("submitted_at", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("Error fetching ambassador recap stats:", error);
      break;
    }
    for (const r of data ?? []) {
      const t = totals.get(r.user_id) ?? { recaps: 0, sampled: 0, sold: 0 };
      t.recaps += 1;
      t.sampled += Number(r.consumers_sampled) || 0;
      t.sold += Number(r.estimated_units_sold) || 0;
      totals.set(r.user_id, t);
    }
    if (!data || data.length < PAGE) break;
  }

  const result = new Map<string, AmbassadorPerformance>();
  totals.forEach((t, id) => {
    result.set(id, {
      ...t,
      conversion_pct: t.sampled >= MIN_SAMPLED_FOR_RATE ? Math.round((t.sold / t.sampled) * 100) : null,
    });
  });
  return result;
}

export async function getActiveAmbassadors(): Promise<Ambassador[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(AMBASSADOR_COLUMNS)
    .eq("role", "staff")
    .eq("status", "active")
    .eq("hempsafe_certified", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching ambassadors:", error);
    return [];
  }

  const rows = data as unknown as AmbassadorRow[];
  const performance = await getPerformanceByUser(rows.map((r) => r.id));
  return rows.map((r) => toAmbassador(r, performance.get(r.id)));
}

export async function getAmbassadorBySlug(slug: string): Promise<Ambassador | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(AMBASSADOR_COLUMNS)
    .eq("slug", slug)
    .eq("role", "staff")
    .eq("status", "active")
    .eq("hempsafe_certified", true)
    .maybeSingle();

  if (error) {
    console.error("Error fetching ambassador:", error);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as AmbassadorRow;
  const performance = await getPerformanceByUser([row.id]);
  return toAmbassador(row, performance.get(row.id));
}

/** Size of the roster shown on /profiles: onboarded (role=staff), active, HempSafe-certified ambassadors. Excludes HubSpot applicants, who have no profiles row. */
export async function countActiveAmbassadors(): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "staff")
    .eq("status", "active")
    .eq("hempsafe_certified", true);

  if (error) {
    console.error("Error counting ambassadors:", error);
    return 0;
  }
  return count ?? 0;
}

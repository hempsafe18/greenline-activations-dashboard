// Pure types and display helpers for ambassador profiles. Kept apart from
// lib/ambassadors.ts (which creates the service-role Supabase client) so client
// components can import them without pulling server-only code into the browser.

export interface AmbassadorPerformance {
  recaps: number;
  sampled: number;
  sold: number;
  /** Whole-number percent (sold ÷ sampled). Null until the ambassador has enough sampling volume to be meaningful. */
  conversion_pct: number | null;
}

export interface Ambassador {
  id: string;
  slug: string;
  name: string;
  headshot_url: string | null;
  has_photo: boolean;
  strengths: string[];
  markets: string[];
  state: string | null;
  city: string | null;
  hempsafe_certified: boolean;
  hempsafe_cert_date: string | null;
  /** Raw "Brand Ambassador Experience" answer from the HubSpot application. */
  experience: string | null;
  /** The "About" answer from the HubSpot application. */
  about: string | null;
  performance: AmbassadorPerformance;
  status: "active" | "inactive";
  created_at: string;
}

// Below this many consumers sampled a rate is noise (1 sampled / 3 sold = 300%),
// and it would be shown to brand managers as a ranking signal.
export const MIN_SAMPLED_FOR_RATE = 10;

/** Conversion for display. Over 100% happens when one consumer buys several units. */
export function formatConversion(pct: number): string {
  return pct > 100 ? "100%+" : `${pct}%`;
}

/**
 * Normalizes the HubSpot application's experience answer, whose wording has
 * changed across form versions, into a short label plus an optional detail.
 */
export function describeExperience(raw: string | null): { label: string; detail?: string } | null {
  const text = raw?.trim();
  if (!text) return null;
  if (/^10\s*\+/.test(text)) return { label: "Experienced rep", detail: "10+ events" };
  if (/^3\s*[–-]\s*10/.test(text)) return { label: "Some experience", detail: "3–10 events" };
  const starter = text.match(/^1\s*[–-]\s*(\d+)/);
  if (starter) return { label: "Getting started", detail: `1–${starter[1]} events` };
  if (/beverage\s*\/?\s*cpg/i.test(text)) return { label: "Beverage / CPG sales background" };
  if (/^no experience/i.test(text)) return { label: "New to brand ambassador work" };
  return { label: text };
}

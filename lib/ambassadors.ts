import { supabase } from "./supabase";

export interface Ambassador {
  id: string;
  name: string;
  headshot_url: string | null;
  strengths: string[];
  markets: string[];
  hempsafe_certified: boolean;
  hempsafe_cert_date: string | null;
  status: "active" | "inactive";
  created_at: string;
}

// Ambassador data lives in the existing ambassador-portal `profiles` table
// (role='staff' distinguishes ambassadors from portal admins). Only the
// columns the directory actually renders are selected — never phone, email,
// street_address, zip_code, or tracking_number.
const AMBASSADOR_COLUMNS =
  "id, name:full_name, headshot_url:avatar_url, strengths, markets, hempsafe_certified, hempsafe_cert_date, status, created_at";

export async function getActiveAmbassadors(): Promise<Ambassador[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(AMBASSADOR_COLUMNS)
    .eq("role", "staff")
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching ambassadors:", error);
    return [];
  }
  return data as unknown as Ambassador[];
}

export async function getAmbassadorById(id: string): Promise<Ambassador | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(AMBASSADOR_COLUMNS)
    .eq("id", id)
    .eq("role", "staff")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("Error fetching ambassador:", error);
    return null;
  }
  return data as unknown as Ambassador | null;
}

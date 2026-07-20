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

export async function getActiveAmbassadors(): Promise<Ambassador[]> {
  const { data, error } = await supabase
    .from("ambassadors")
    .select("*")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching ambassadors:", error);
    return [];
  }
  return data as Ambassador[];
}

export async function getAmbassadorById(id: string): Promise<Ambassador | null> {
  const { data, error } = await supabase
    .from("ambassadors")
    .select("*")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("Error fetching ambassador:", error);
    return null;
  }
  return data as Ambassador | null;
}

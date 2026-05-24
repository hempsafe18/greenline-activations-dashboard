import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// ── Env vars (set in Supabase Dashboard → Edge Functions → Secrets) ──────────
// GOOGLE_SPREADSHEET_ID   – the ID from your sheet URL (/spreadsheets/d/<ID>/edit)
// GOOGLE_SERVICE_ACCOUNT_JSON – the full JSON key for your service account
// SHEET_NAME_AMIGOS        – exact tab name in the sheet, e.g. "AMIGOS Recaps"
// SHEET_NAME_3CHI          – exact tab name, e.g. "3CHI Recaps"
// SHEET_NAME_MELLOW_FELLOW – exact tab name, e.g. "Mellow Fellow Recaps"

const SPREADSHEET_ID = Deno.env.get("GOOGLE_SPREADSHEET_ID") ?? "";
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") ?? "";

// Brand name (from recaps.brand_name) → Google Sheet tab name
const BRAND_TO_SHEET: Record<string, string> = {
  "AMIGOS":        Deno.env.get("SHEET_NAME_AMIGOS")        ?? "AMIGOS",
  "Amigos":        Deno.env.get("SHEET_NAME_AMIGOS")        ?? "AMIGOS",
  "3CHI":          Deno.env.get("SHEET_NAME_3CHI")          ?? "3CHI",
  "3chi":          Deno.env.get("SHEET_NAME_3CHI")          ?? "3CHI",
  "MELLOW FELLOW": Deno.env.get("SHEET_NAME_MELLOW_FELLOW") ?? "Mellow Fellow",
  "Mellow Fellow": Deno.env.get("SHEET_NAME_MELLOW_FELLOW") ?? "Mellow Fellow",
};

// ── Column mapping: Google Sheet header → recaps table field ─────────────────
// The function reads row 1 of the target sheet to get the actual column order,
// then builds the row using this map. Add or rename entries here if your sheet
// headers differ from the defaults below.
const HEADER_TO_FIELD: Record<string, string | ((r: Recap) => string)> = {
  "Timestamp":                        (r) => r.submitted_at ? new Date(r.submitted_at).toLocaleString("en-US") : new Date().toLocaleString("en-US"),
  "Brand Name":                       "brand_name",
  "Store Name":                       "store_name",
  "Store Type":                       "store_type",
  "City":                             "city",
  "Activation Date":                  "activation_date",
  "Shift Start Time":                 "shift_start_time",
  "Shift Start Time ":                "shift_start_time", // trailing-space variant common in Form exports
  "Shift End Time":                   "shift_end_time",
  "Geo Check-In":                     "geo_checkin",
  "Arrival Status":                   "arrival_status",
  "Late (minutes)":                   "late_minutes",
  "Setup Photo":                      "setup_photo",
  "Shelf Photo":                      "shelf_photo",
  "Engagement photo submission":      "engagement_photos",
  "Engagement Photo Submission":      "engagement_photos",
  "Sampling Type":                    "sampling_type",
  "Products Featured":                "products_featured",
  "Used Tally App":                   "used_tally_app",
  "Tally Screenshot":                 "tally_screenshot",
  "Consumers Approached":             "consumers_approached",
  "Total consumers sampled":          "consumers_sampled",
  "Consumers Sampled":                "consumers_sampled",
  "Estimated units sold":             "estimated_units_sold",
  "Estimated Units Sold":             "estimated_units_sold",
  "Top performing flavor":            "top_performing_flavor",
  "Top Performing Flavor":            "top_performing_flavor",
  "Consumer objections encountered":  "consumer_objections",
  "Consumer Objections":              "consumer_objections",
  "Product in Stock":                 "product_in_stock",
  "Units at Start":                   "units_start",
  "Units at End":                     "units_end",
  "Shelf Placement":                  "shelf_placement",
  "Price Displayed":                  "price_displayed",
  "Promo Signage Present":            "promo_signage_present",
  "Reorder Needed":                   "reorder_needed",
  "Competitor Sampling":              "competitor_sampling",
  "Competitor Details":               "competitor_details",
  "Spoke With Manager":               "spoke_with_manager",
  "Manager Sentiment":                "manager_sentiment",
  "Educated Staff":                   "educated_staff",
  "Future Activations Interest":      "future_activations_interest",
  "Manager Notes":                    "manager_notes",
  "Performance Rating":               "performance_rating",
  "Product Knowledge Rating":         "product_knowledge_rating",
  "Issues Occurred":                  "issues_occurred",
  "Issue Description":                "issue_description",
  "Recommend Account Again":          "recommend_account_again",
  "Reorder Flagged":                  "reorder_flagged",
  "Follow-Up Required":               "followup_required",
  "Follow-Up Description":            "followup_description",
  "Price 10mg 4-Pack":                "price_10mg_4pk",
  "Price 25mg 4-Pack":                "price_25mg_4pk",
  "Price 50mg 4-Pack":                "price_50mg_4pk",
  "Single Cans Offered":              "single_cans_offered",
  "Primary Age Group":                "primary_age_group",
  "Primary Gender":                   "primary_gender",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Recap {
  [key: string]: unknown;
  submitted_at?: string;
  brand_name?: string;
  store_name?: string;
}

// ── Google auth: RS256 JWT → access token ────────────────────────────────────
async function signRS256(privateKeyPem: string, payload: object): Promise<string> {
  const pem = privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const header  = b64url({ alg: "RS256", typ: "JWT" });
  const body    = b64url(payload);
  const signing = `${header}.${body}`;

  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signing));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signing}.${sigB64}`;
}

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signRS256(sa.private_key, {
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  });

  const res  = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Google token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Sheets API helpers ────────────────────────────────────────────────────────
async function getSheetHeaders(token: string, sheetName: string): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!1:1`;
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets read error: ${JSON.stringify(data)}`);
  return (data.values?.[0] as string[]) ?? [];
}

async function appendRow(token: string, sheetName: string, values: string[]): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res  = await fetch(url, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ values: [values] }),
  });
  if (!res.ok) throw new Error(`Sheets append error: ${await res.text()}`);
}

// ── Row builder ───────────────────────────────────────────────────────────────
function buildRow(recap: Recap, headers: string[]): string[] {
  return headers.map((h) => {
    const mapping = HEADER_TO_FIELD[h];
    if (!mapping)                          return "";
    if (typeof mapping === "function")     return String(mapping(recap) ?? "");
    return String(recap[mapping as string] ?? "");
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" },
    });
  }

  try {
    if (!SPREADSHEET_ID)       throw new Error("GOOGLE_SPREADSHEET_ID is not set");
    if (!SERVICE_ACCOUNT_JSON) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

    const body = await req.json();

    // Accept Supabase DB webhook format ({ type, record, ... }) or direct call ({ ...recapFields })
    const recap: Recap = body.record ?? body.recap ?? body;

    if (!recap.store_name && !recap.brand_name) {
      return new Response(JSON.stringify({ error: "Payload missing recap data (store_name / brand_name)" }), { status: 400 });
    }

    // Normalise to upper-case so "Amigos", "AMIGOS", "amigos" all resolve correctly.
    // The function only writes to the sheet belonging to this recap's brand — no cross-brand writes.
    const rawBrand   = String(recap.brand_name ?? "").trim();
    const normalised = rawBrand.toUpperCase();
    const sheetName  = BRAND_TO_SHEET[rawBrand] ?? BRAND_TO_SHEET[normalised];

    if (!sheetName) {
      return new Response(
        JSON.stringify({ error: `No sheet mapping for brand "${rawBrand}". Check SHEET_NAME_* secrets.` }),
        { status: 400 },
      );
    }

    const sa          = JSON.parse(SERVICE_ACCOUNT_JSON);
    const token       = await getAccessToken(sa);
    const headers     = await getSheetHeaders(token, sheetName);

    if (headers.length === 0) {
      return new Response(JSON.stringify({ error: `Sheet "${sheetName}" not found or has no header row` }), { status: 404 });
    }

    const row = buildRow(recap, headers);
    await appendRow(token, sheetName, row);

    console.log(`Appended recap for "${rawBrand}" → sheet "${sheetName}" (${row.length} columns)`);

    return new Response(JSON.stringify({ success: true, brand: rawBrand, sheet: sheetName, columns: row.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync-recap-to-sheets:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

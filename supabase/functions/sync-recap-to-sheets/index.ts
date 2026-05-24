import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// ── Env vars ──────────────────────────────────────────────────────────────────
// APPS_SCRIPT_URL       – Web app URL from your deployed Google Apps Script
// APPS_SCRIPT_SECRET    – Must match the WEBHOOK_SECRET script property in Apps Script
// SHEET_GID_AMIGOS      – numeric GID for the AMIGOS tab
// SHEET_GID_3CHI        – numeric GID for the 3CHI tab
// SHEET_GID_MELLOW_FELLOW – numeric GID for the Mellow Fellow tab

const APPS_SCRIPT_URL    = Deno.env.get("APPS_SCRIPT_URL")        ?? "";
const APPS_SCRIPT_SECRET = Deno.env.get("APPS_SCRIPT_SECRET")     ?? "";

const BRAND_TO_GID: Record<string, string> = {
  "AMIGOS":        Deno.env.get("SHEET_GID_AMIGOS")        ?? "",
  "3CHI":          Deno.env.get("SHEET_GID_3CHI")          ?? "",
  "MELLOW FELLOW": Deno.env.get("SHEET_GID_MELLOW_FELLOW") ?? "",
};

interface Recap {
  [key: string]: unknown;
  submitted_at?: string;
  brand_name?: string;
  store_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" },
    });
  }

  try {
    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL is not set");

    const body   = await req.json();
    const recap: Recap = body.record ?? body.recap ?? body;

    if (!recap.brand_name) {
      return new Response(JSON.stringify({ error: "Missing brand_name in payload" }), { status: 400 });
    }

    const rawBrand   = String(recap.brand_name).trim();
    const normalised = rawBrand.toUpperCase();
    const gid        = BRAND_TO_GID[rawBrand] ?? BRAND_TO_GID[normalised];

    if (!gid) {
      return new Response(
        JSON.stringify({ error: `No GID mapping for brand "${rawBrand}". Check SHEET_GID_* secrets.` }),
        { status: 400 },
      );
    }

    // Forward to Apps Script — secret as query param (Apps Script drops custom headers)
    const url = APPS_SCRIPT_SECRET
      ? `${APPS_SCRIPT_URL}?secret=${encodeURIComponent(APPS_SCRIPT_SECRET)}`
      : APPS_SCRIPT_URL;

    const res  = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ record: { ...recap, sheet_gid: gid } }),
    });

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    console.log(`sync-recap-to-sheets: brand="${rawBrand}" gid=${gid} status=${res.status}`, data);

    return new Response(JSON.stringify(data), {
      status:  res.ok ? 200 : 502,
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

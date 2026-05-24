import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Resolve a brand name / slug to its exact storage folder name.
 * Storage bucket layout: recap-photos/{client-folder}/{category}/{file}
 * Known client folders: amigos, 3chi, mellow_fellow
 */
function resolveClientFolder(raw: string): string | null {
  const n = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (n === "amigos") return "amigos";
  if (n === "3chi") return "3chi";
  if (n === "mellow-fellow" || raw.toLowerCase().includes("mellow")) return "mellow_fellow";
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "Expected multipart/form-data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const formData = await req.formData();
    const clientRaw = (formData.get("client") as string || "").trim();
    const category  = (formData.get("category") as string || "").trim();
    const staffName = (formData.get("staff_name") as string || "unknown")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    // Validate client
    const clientFolder = resolveClientFolder(clientRaw);
    if (!clientFolder) {
      return new Response(
        JSON.stringify({
          error: `Unknown client "${clientRaw}". Expected: amigos, 3chi, mellow-fellow`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate category
    const validCategories = ["setup", "shelf", "engagement", "tally", "breakdown"];
    if (!category || !validCategories.includes(category)) {
      return new Response(
        JSON.stringify({
          error: `Invalid category "${category}". Use: ${validCategories.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const files = formData.getAll("files");
    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const urls: string[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${clientFolder}/${category}/${staffName}_${timestamp}_${crypto.randomUUID().slice(0, 8)}.${ext}`;

      const bytes = new Uint8Array(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from("recap-photos")
        .upload(filePath, bytes, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed for ${file.name}: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from("recap-photos")
        .getPublicUrl(filePath);

      urls.push(urlData.publicUrl);
    }

    return new Response(
      JSON.stringify({ success: true, urls }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

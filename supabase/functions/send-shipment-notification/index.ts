import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Emails a brand ambassador when a shipment is logged: what was sent, the ship date,
// the tracking number, that a signature is required, and what to do if they miss it.
// Called by the Next API routes right after a shipment insert:
//   { kind: "inventory" | "materials", ids: [shipment row ids] }
// The payload only carries row ids; every value in the email is read from the DB, so a
// caller can't make this send arbitrary content. Every attempt is logged to
// public.shipment_email_log, and a shipment that already has a "sent" row is never re-sent.

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const fmtShipDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

// UPS tracking numbers start with 1Z; everything else we ship is FedEx.
function carrierFor(tracking: string) {
  const t = tracking.replace(/\s/g, "");
  if (/^1Z/i.test(t)) return { name: "UPS", url: `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}` };
  return { name: "FedEx", url: `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}` };
}

type Line = { label: string; qty: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let shipmentRef = "", to: string | null = null;
  try {
    const { kind, ids } = await req.json();
    if ((kind !== "inventory" && kind !== "materials") || !Array.isArray(ids) || ids.length === 0) {
      return json({ error: "kind (inventory|materials) and ids[] required" }, 400);
    }

    const lines: Line[] = [];
    let userId = "", trackingNumber = "", shippedAt = "", notes: string | null = null;

    if (kind === "inventory") {
      const { data: rows, error } = await supabase
        .from("ambassador_inventory_shipments")
        .select("id, user_id, sku, cases_sent, tracking_number, shipped_at, notes, materials, sku_info:inventory_skus(flavor_name)")
        .in("id", ids);
      if (error || !rows?.length) return json({ error: `shipment not found: ${error?.message}` }, 404);
      shipmentRef = `inventory:${rows.map((r) => r.id).sort().join(",")}`;
      ({ user_id: userId, tracking_number: trackingNumber, shipped_at: shippedAt, notes } = rows[0]);
      for (const r of rows) {
        const flavor = (r.sku_info as { flavor_name?: string } | null)?.flavor_name || r.sku;
        lines.push({ label: flavor, qty: `${r.cases_sent} ${r.cases_sent === 1 ? "case" : "cases"}` });
      }
      for (const m of (rows[0].materials || []) as { item: string; quantity: number }[]) {
        lines.push({ label: m.item, qty: `× ${m.quantity}` });
      }
    } else {
      const { data: row, error } = await supabase
        .from("ambassador_materials_shipments")
        .select("id, user_id, tracking_number, shipped_at, notes, materials")
        .eq("id", ids[0])
        .single();
      if (error || !row) return json({ error: `shipment not found: ${error?.message}` }, 404);
      shipmentRef = `materials:${row.id}`;
      ({ user_id: userId, tracking_number: trackingNumber, shipped_at: shippedAt, notes } = row);
      for (const m of (row.materials || []) as { item: string; quantity: number }[]) {
        lines.push({ label: m.item, qty: `× ${m.quantity}` });
      }
    }

    const { data: already } = await supabase.from("shipment_email_log").select("id").eq("shipment_ref", shipmentRef).eq("status", "sent").limit(1).maybeSingle();
    if (already) return json({ success: true, skipped: "already sent" });

    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
    to = (profile?.email || "").trim() || null;
    if (!to) {
      await supabase.from("shipment_email_log").insert({ shipment_ref: shipmentRef, user_id: userId, status: "skipped_no_email" });
      return json({ success: true, skipped: "no ambassador email" });
    }

    const first = (profile?.full_name || "").trim().split(" ")[0];
    const carrier = carrierFor(trackingNumber);
    const shipDate = fmtShipDate(shippedAt);

    const rowsHtml = lines.map((l) =>
      `<tr><td style="padding:10px 0;border-bottom:1px solid rgba(10,10,10,0.05);font-size:15px">${esc(l.label)}</td><td style="padding:10px 0;border-bottom:1px solid rgba(10,10,10,0.05);font-size:15px;font-weight:800;text-align:right;white-space:nowrap">${esc(l.qty)}</td></tr>`
    ).join("");

    const html = `
<div style="background:#faf0ea;padding:24px;font-family:Manrope,Helvetica,Arial,sans-serif;color:#0a0a0a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid rgba(10,10,10,0.05);box-shadow:0 2px 8px rgba(10,10,10,0.08);padding:28px">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#0a0a0a66">Greenline Activations · Shipment notice</div>
    <div style="margin:14px 0 6px"><span style="display:inline-block;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:800;color:#fff;background:#00c853">PACKAGE ON THE WAY</span></div>
    <h1 style="font-size:24px;font-weight:900;letter-spacing:-0.02em;margin:8px 0 12px">Your activation gear shipped${first ? `, ${esc(first)}` : ""}.</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 18px">Watch for it. Your package ships from Greenline on <strong>${esc(shipDate)}</strong>.</p>

    <div style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#0a0a0a66;margin-bottom:4px">What's in the box</div>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid rgba(10,10,10,0.05)">${rowsHtml}</table>
    ${notes ? `<p style="font-size:13px;color:#0a0a0a99;margin:12px 0 0">Note: ${esc(notes)}</p>` : ""}

    <div style="margin:22px 0 0;background:#e8f5e9;border-radius:12px;padding:16px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#0a0a0a66">${esc(carrier.name)} tracking number</div>
      <div style="font-size:18px;font-weight:800;letter-spacing:0.02em;margin:4px 0 12px;word-break:break-all">${esc(trackingNumber)}</div>
      <a href="${esc(carrier.url)}" style="display:inline-block;background:#00c853;color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:12px;padding:11px 20px">Track package</a>
    </div>

    <div style="margin:16px 0 0;background:#ff4f331a;border:1px solid #ff4f334d;border-radius:12px;padding:16px">
      <div style="font-size:14px;font-weight:800;color:#ff4f33;margin-bottom:4px">Signature required</div>
      <div style="font-size:14px;line-height:1.5">Someone 18+ has to be there to sign. Nobody signs, no drop-off.</div>
    </div>

    <div style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#0a0a0a66;margin:22px 0 6px">Missed the delivery?</div>
    <p style="font-size:14px;line-height:1.5;margin:0">Reschedule the delivery with ${esc(carrier.name)} using the tracking number above, or pick it up at your local ${esc(carrier.name)} location. Bring a photo ID.</p>

    <p style="font-size:13px;color:#0a0a0a99;margin:22px 0 0">Package doesn't show up? Reply to this email or call 904-587-4967.</p>
  </div>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Greenline Activations <team@updates.greenlineactivations.com>",
        to: [to],
        reply_to: "info@greenlineactivations.com",
        subject: `Shipped ${new Date(shippedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}: your Greenline package (signature required)`,
        html,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await supabase.from("shipment_email_log").insert({ shipment_ref: shipmentRef, user_id: userId, to_email: to, status: "failed", error: JSON.stringify(data) });
      return json({ success: false, error: data }, 502);
    }
    await supabase.from("shipment_email_log").insert({ shipment_ref: shipmentRef, user_id: userId, to_email: to, status: "sent", resend_id: data.id });
    return json({ success: true, email_id: data.id, to });
  } catch (err) {
    if (shipmentRef) {
      await supabase.from("shipment_email_log").insert({ shipment_ref: shipmentRef, to_email: to, status: "failed", error: (err as Error).message }).then(() => {}, () => {});
    }
    return json({ error: (err as Error).message }, 500);
  }
});

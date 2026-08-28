import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// The client dashboard (greenline-activations-dashboard) has no direct Supabase-Auth
// session for clients — it derives a brand code (e.g. "AMIGOS") from the client's Clerk
// email domain, and that same brand code (not clients.id) is what client_notifications.client_id
// holds for anything meant to show up in the dashboard's own Notifications tab (see
// app/api/notifications/route.ts and app/api/request/route.ts in that repo, and the
// pre-existing notify_recap_submitted() Postgres function which uses the same convention).
// Rows written with clients.id instead (as some other Edge Functions do) never surface there.
const CLIENT_BRAND_CODE: Record<string, string> = {
  "Amigos": "AMIGOS",
  "3CHI": "3CHI",
  "Mellow Fellow": "MELLOW FELLOW",
  "Grow": "GROW",
  "Groovewagon": "GROOVEWAGON",
  "Willie's Remedy": "WILLIES_REMEDY",
};

// Matches the app/clients/<slug> routing in greenline-activations-dashboard, and the
// ?section=shipment deep link added to those pages for the "Log Shipment" tab.
const CLIENT_ROUTE_SLUG: Record<string, string> = {
  "Amigos": "amigos",
  "3CHI": "3chi",
  "Mellow Fellow": "mellow-fellow",
  "Grow": "grow",
  "Groovewagon": "groovewagon",
  "Willie's Remedy": "willies-remedy",
  // Claybourne Co. has no shipment/inventory concept (educational activation client,
  // no physical sample stock to alert on), so it's intentionally absent from both maps above.
};

const DASHBOARD_ORIGIN = "https://dashboard.greenlineactivations.com";

function buildLowInventoryHtml(vars: Record<string, string>): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f8f7f4;-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:0 auto;padding:48px 24px;">
    <div style="background:#ffffff;border:2px solid #1a1a1a;padding:40px 36px;">
      <div style="display:inline-block;background:#ff4f33;color:#ffffff;font-size:11px;font-weight:700;padding:5px 12px;text-transform:uppercase;letter-spacing:0.8px;border-radius:2px;">Low Inventory</div>
      <h1 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:20px 0 8px;line-height:1.3;">${vars.FLAVOR_NAME} is running low with ${vars.AMBASSADOR_NAME}</h1>
      <p style="font-size:14px;color:#555555;margin-bottom:28px;line-height:1.6;">Hi ${vars.CLIENT_FIRST_NAME}, after the most recent activation recap, ${vars.AMBASSADOR_NAME} is down to just ${vars.CANS_REMAINING} cans of ${vars.FLAVOR_NAME}. You may want to send a replenishment shipment before their next activation.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:14px 0;border-bottom:1px solid #f0ede8;vertical-align:top;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#999999;width:130px;">Ambassador</td><td style="padding:14px 0;border-bottom:1px solid #f0ede8;vertical-align:top;font-size:14px;font-weight:500;color:#1a1a1a;">${vars.AMBASSADOR_NAME}</td></tr>
        <tr><td style="padding:14px 0;border-bottom:1px solid #f0ede8;vertical-align:top;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#999999;width:130px;">Market</td><td style="padding:14px 0;border-bottom:1px solid #f0ede8;vertical-align:top;font-size:14px;font-weight:500;color:#1a1a1a;">${vars.MARKET}</td></tr>
        <tr><td style="padding:14px 0;border-bottom:1px solid #f0ede8;vertical-align:top;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#999999;width:130px;">Flavor</td><td style="padding:14px 0;border-bottom:1px solid #f0ede8;vertical-align:top;font-size:14px;font-weight:500;color:#1a1a1a;">${vars.FLAVOR_NAME}</td></tr>
        <tr><td style="padding:14px 0;vertical-align:top;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#999999;width:130px;">Cans Remaining</td><td style="padding:14px 0;vertical-align:top;font-size:14px;font-weight:700;color:#ff4f33;">${vars.CANS_REMAINING}</td></tr>
      </table>
      <div style="margin-top:28px;text-align:center;">
        <a href="${vars.SHIPMENT_URL}" style="display:inline-block;background:#1a1a1a;color:#faf0ea;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:14px 28px;text-decoration:none;">Log a Replenishment Shipment</a>
      </div>
      <div style="height:1px;background:#eeeeee;margin:28px 0 24px;"></div>
      <div style="text-align:center;font-size:11px;color:#aaaaaa;letter-spacing:0.3px;text-transform:uppercase;">Greenline Activations</div>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { record } = await req.json();
    // record is a recap_inventory_usage row: { id, recap_id, event_id, user_id, sku, cans_used, cans_remaining, reported_at }
    if (!record) {
      return new Response(JSON.stringify({ error: "record is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Defense in depth: the DB trigger already filters to cans_remaining < 6, but this
    // function can be invoked directly (e.g. for testing), so re-check here too.
    if (record.cans_remaining === null || record.cans_remaining === undefined || Number(record.cans_remaining) >= 6) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "cans_remaining not below threshold" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!record.event_id) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no event_id on recap_inventory_usage row, can't route to a client" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: event }, { data: ambassador }, { data: sku }] = await Promise.all([
      supabase.from("events").select("id, title, city, client:clients(id, company_name, contact_name, contact_email)").eq("id", record.event_id).maybeSingle(),
      supabase.from("profiles").select("full_name, city, state").eq("id", record.user_id).maybeSingle(),
      supabase.from("inventory_skus").select("flavor_name").eq("sku", record.sku).maybeSingle(),
    ]);

    if (!event?.client) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "event has no client linked" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const client = event.client as { id: string; company_name: string; contact_name: string; contact_email: string };
    const brandCode = CLIENT_BRAND_CODE[client.company_name] ?? client.company_name.toUpperCase();
    const routeSlug = CLIENT_ROUTE_SLUG[client.company_name] ?? client.company_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const ambassadorName = ambassador?.full_name || "Your ambassador";
    const flavorName = sku?.flavor_name || record.sku;
    const market = event.city || ambassador?.city || "their market";
    const cansRemaining = record.cans_remaining;

    const subject = `Low Inventory Alert: ${flavorName} running low with ${ambassadorName}`;
    const shipmentUrl = `${DASHBOARD_ORIGIN}/clients/${routeSlug}?section=shipment`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Greenline Activations <team@updates.greenlineactivations.com>",
        to: [client.contact_email],
        subject,
        html: buildLowInventoryHtml({
          CLIENT_FIRST_NAME: (client.contact_name || "there").split(" ")[0],
          AMBASSADOR_NAME: ambassadorName,
          MARKET: market,
          FLAVOR_NAME: flavorName,
          CANS_REMAINING: String(cansRemaining),
          SHIPMENT_URL: shipmentUrl,
        }),
        headers: { "List-Unsubscribe": "<mailto:support@greenlineactivations.com>" },
      }),
    });
    const emailSent = emailRes.ok;

    // NOTE: unlike activation_scheduled/staff_assigned/pre_event_checklist notifications
    // (which the CEO had disabled — those Edge Functions log a client_notifications row
    // with email_sent hardcoded to false and never call Resend), this is a distinct,
    // newly-requested notification type and defaults to actually sending. Don't wire this
    // type into whatever "client emails are off" switch governs those other three.
    const { error: insertError } = await supabase.from("client_notifications").insert({
      client_id: brandCode,
      event_id: event.id,
      type: "low_inventory_alert",
      subject,
      body: `${ambassadorName} in ${market} is down to ${cansRemaining} cans of ${flavorName}. Consider sending a replenishment shipment.`,
      email_sent: emailSent,
      metadata: {
        sku: record.sku,
        flavor_name: flavorName,
        ambassador_id: record.user_id,
        ambassador_name: ambassadorName,
        cans_remaining: cansRemaining,
        recap_id: record.recap_id,
        shipment_url: shipmentUrl,
      },
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message, email_sent: emailSent }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, email_sent: emailSent, client_id: brandCode }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

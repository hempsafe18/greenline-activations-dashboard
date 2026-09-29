import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Emails ONLY the team member who submitted a client-dashboard event request.
// Kinds: approved | declined | cancelled | rescheduled. Created 2026-09-29.
// Called by DB triggers via pg_net:
//   { kind, request_id, old_date?, old_start?, old_end? }
// Requester email comes from client_notifications.requester_email, falling back to
// metadata.requesterEmail. No requester email -> logged as skipped_no_email, nothing sent.
// Every attempt is logged to public.requester_email_log.

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function fmtDate(d?: string | null) {
  if (!d) return "TBD";
  const dt = new Date(`${d}T12:00:00Z`);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function fmtTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
}
const range = (s?: string | null, e?: string | null) => (s ? `${fmtTime(s)}${e ? ` – ${fmtTime(e)}` : ""}` : "Time TBD");

const COPY: Record<string, { tag: string; color: string; subject: (store: string, date: string) => string; lead: string }> = {
  approved:    { tag: "APPROVED",    color: "#00c853", subject: (s, d) => `Approved: ${s} on ${d}`,    lead: "Your demo request is approved and on the schedule. We'll staff it with a HempSafe-certified ambassador." },
  declined:    { tag: "DECLINED",    color: "#ff4f33", subject: (s, d) => `Declined: ${s} on ${d}`,    lead: "We can't take this demo request as submitted. Independent-account demos need at least 14 days' notice and must be requested through the dashboard. Reply to this email if you want to set a new date." },
  cancelled:   { tag: "CANCELLED",   color: "#ff4f33", subject: (s, d) => `CANCELLED: ${s} on ${d}`,   lead: "This demo is cancelled and will not take place. Please let the account know." },
  rescheduled: { tag: "RESCHEDULED", color: "#0a0a0a", subject: (s, d) => `Rescheduled: ${s} — now ${d}`, lead: "This demo has been moved. Please let the account know the new date and time." },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let kind = "", request_id: string | null = null, event_id: string | null = null, to: string | null = null;
  try {
    const p = await req.json();
    kind = p.kind; request_id = p.request_id;
    if (!COPY[kind] || !request_id) return json({ error: "kind (approved|declined|cancelled|rescheduled) and request_id required" }, 400);

    const { data: r, error } = await supabase.from("client_notifications").select("*").eq("id", request_id).single();
    if (error || !r) return json({ error: `request not found: ${error?.message}` }, 404);
    const md = r.metadata || {};
    event_id = r.event_id;
    to = (r.requester_email || md.requesterEmail || md.requester_email || "").trim() || null;
    const name = (r.requester_name || md.requesterName || "").trim();

    let ev: any = null;
    if (r.event_id) {
      const { data } = await supabase.from("events").select("location_name, location_address, event_date, start_time, end_time").eq("id", r.event_id).maybeSingle();
      ev = data;
    }
    const store = (ev?.location_name || md.storeName || "your requested store").trim();
    const address = ev?.location_address || md.address || "";
    const date = ev?.event_date || md.date;
    const start = ev?.start_time || md.startTime;
    const end = ev?.end_time || md.endTime;

    if (!to) {
      await supabase.from("requester_email_log").insert({ request_id, event_id, kind, status: "skipped_no_email" });
      return json({ success: true, skipped: "no requester email on request" });
    }

    const c = COPY[kind];
    const wasLine = kind === "rescheduled" && p.old_date
      ? `<tr><td style="padding:6px 0;color:#0a0a0a99;width:110px">Was</td><td style="padding:6px 0;text-decoration:line-through;color:#0a0a0a99">${esc(fmtDate(p.old_date))}, ${esc(range(p.old_start, p.old_end))}</td></tr>` : "";
    const whenLabel = kind === "rescheduled" ? "New date" : "Date";
    const html = `
<div style="background:#faf0ea;padding:24px;font-family:Manrope,Helvetica,Arial,sans-serif;color:#0a0a0a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid rgba(10,10,10,0.05);box-shadow:0 2px 8px rgba(10,10,10,0.08);padding:28px">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#0a0a0a66">Greenline Activations · Demo request update</div>
    <div style="margin:14px 0 6px"><span style="display:inline-block;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:800;color:#fff;background:${c.color}">${c.tag}</span></div>
    <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;margin:8px 0 12px">${esc(store)}</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 18px">${name ? `Hi ${esc(name.split(" ")[0])}, ` : ""}${esc(c.lead)}</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;border-top:1px solid rgba(10,10,10,0.05)">
      ${wasLine}
      <tr><td style="padding:6px 0;color:#0a0a0a99;width:110px">${whenLabel}</td><td style="padding:6px 0;font-weight:700">${esc(fmtDate(date))}, ${esc(range(start, end))}</td></tr>
      ${address ? `<tr><td style="padding:6px 0;color:#0a0a0a99">Address</td><td style="padding:6px 0">${esc(address)}</td></tr>` : ""}
      ${md.notes ? `<tr><td style="padding:6px 0;color:#0a0a0a99">Your notes</td><td style="padding:6px 0">${esc(md.notes)}</td></tr>` : ""}
    </table>
    <p style="font-size:13px;color:#0a0a0a99;margin:20px 0 0">Questions? Reply to this email or call 904-587-4967.</p>
  </div>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Greenline Activations <team@updates.greenlineactivations.com>",
        to: [to],
        reply_to: "info@greenlineactivations.com",
        subject: c.subject(store, `${fmtDate(date)}`),
        html,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await supabase.from("requester_email_log").insert({ request_id, event_id, kind, to_email: to, status: "failed", error: JSON.stringify(data) });
      return json({ success: false, error: data }, 502);
    }
    await supabase.from("requester_email_log").insert({ request_id, event_id, kind, to_email: to, status: "sent", resend_id: data.id });
    return json({ success: true, email_id: data.id, to });
  } catch (err) {
    await supabase.from("requester_email_log").insert({ request_id, event_id, kind: COPY[kind] ? kind : "approved", to_email: to, status: "failed", error: (err as Error).message }).then(() => {}, () => {});
    return json({ error: (err as Error).message }, 500);
  }
});

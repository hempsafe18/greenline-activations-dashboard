// Fires the send-shipment-notification Edge Function after a shipment is logged.
// Never throws: the shipment is already saved, so an email problem must not turn a
// successful log into an error for the client. Failures are recorded by the function
// itself in shipment_email_log.
export async function notifyAmbassadorOfShipment(kind: 'inventory' | 'materials', ids: string[]) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-shipment-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
        apikey: process.env.SUPABASE_SECRET_KEY!,
      },
      body: JSON.stringify({ kind, ids }),
    });
    if (!res.ok) console.error('shipment notification failed', res.status, await res.text().catch(() => ''));
  } catch (err) {
    console.error('shipment notification error', err);
  }
}

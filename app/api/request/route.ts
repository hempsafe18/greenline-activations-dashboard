import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storeName, address, date, startTime, endTime, client, notes, requestType = "New Activation Request" } = body;

    const notifSubjectMap: Record<string, string> = {
      "New Activation Request": `New Event Request: ${storeName}`,
      "Edit Request": `Edit Request: ${storeName}`,
      "Cancel Request": `Cancellation Request: ${storeName}`,
    };
    const notifBodyMap: Record<string, string> = {
      "New Activation Request": `Your activation request for ${storeName} on ${date} has been received. The Greenline team will confirm details shortly.${notes ? ` Notes: ${notes}` : ""}`,
      "Edit Request": `An edit request for your activation at ${storeName} on ${date} has been submitted.${notes ? ` Details: ${notes}` : ""}`,
      "Cancel Request": `A cancellation request for your activation at ${storeName} on ${date} has been submitted.${notes ? ` Reason: ${notes}` : ""}`,
    };

    if (client) {
      await supabase.from('client_notifications').insert({
        client_id: client,
        type: requestType === "New Activation Request" ? "update" : "alert",
        subject: notifSubjectMap[requestType] ?? `${requestType}: ${storeName}`,
        body: notifBodyMap[requestType] ?? `Type: ${requestType}\nClient: ${client}\nStore: ${storeName}\nDate: ${date}`,
        read: false,
        metadata: { storeName, address, date, startTime, endTime, requestType },
      });
    }

    return NextResponse.json({ success: true, message: "Request sent successfully" });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: "Failed to process request" }, { status: 500 });
  }
}

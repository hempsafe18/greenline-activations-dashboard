import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Added 'notes' and 'requestType' to the incoming data
    const { storeName, address, date, startTime, endTime, client, notes, requestType = "New Activation Request" } = body;

    const notificationText = `
      Type: ${requestType}
      Client: ${client}
      Store: ${storeName}
      Address: ${address || 'N/A'}
      Date: ${date}
      Time: ${startTime || 'N/A'} - ${endTime || 'N/A'}
      Notes: ${notes || 'None provided'}
    `;

    const companyMap: Record<string, string> = {
      "3CHI": "PASTE_3CHI_COMPANY_ID",
      "Plift": "PASTE_PLIFT_COMPANY_ID",
      "Gigli": "PASTE_GIGLI_COMPANY_ID"
    };

    const targetCompanyId = companyMap[client];
    const isRealCompanyId = targetCompanyId && !targetCompanyId.startsWith('PASTE_');
    const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;

    if (hubspotToken) {
      const payload: any = {
        properties: {
          dealname: `${requestType}: ${storeName} (${client})`,
          description: notificationText,
          pipeline: "883257455",
          dealstage: "1327057675"
        }
      };

      if (isRealCompanyId) {
        payload.associations = [
          {
            to: { id: targetCompanyId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 5 }]
          }
        ];
      }

      const response = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error("HubSpot Error:", await response.text());
        return NextResponse.json({ success: false, error: "Failed to create deal in HubSpot" }, { status: 500 });
      }
    } else {
      console.warn("No HubSpot token found in environment variables.");
    }

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
        body: notifBodyMap[requestType] ?? notificationText.trim(),
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

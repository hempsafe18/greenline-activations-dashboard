import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Unpack the data sent from the dashboard
    const body = await req.json();
    const { storeName, address, date, startTime, endTime, client } = body;

    const notificationText = `
      New Activation Request!
      Client: ${client}
      Store: ${storeName}
      Address: ${address}
      Date: ${date}
      Time: ${startTime} - ${endTime}
    `;

    // 2. SEND TO HUBSPOT (Creates a new "Deal" in your CRM)
    const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;
    
    if (hubspotToken) {
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            dealname: `Activation Request: ${storeName} (${client})`,
            description: notificationText,
            dealstage: "appointmentscheduled", // A standard default HubSpot stage
            pipeline: "default"
          }
        })
      });

      if (!response.ok) {
        console.error("HubSpot Error:", await response.text());
        return NextResponse.json({ success: false, error: "Failed to create deal in HubSpot" }, { status: 500 });
      }
    } else {
      console.warn("No HubSpot token found in environment variables.");
    }

    // Tell the dashboard it was successful
    return NextResponse.json({ success: true, message: "Request sent to HubSpot successfully" });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: "Failed to process request" }, { status: 500 });
  }
}

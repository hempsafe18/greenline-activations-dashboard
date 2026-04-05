import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
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
            
            // --- UPDATED HUBSPOT ROUTING ---
            pipeline: "883257455", 
            dealstage: "1327057675"
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

    return NextResponse.json({ success: true, message: "Request sent to HubSpot successfully" });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: "Failed to process request" }, { status: 500 });
  }
}

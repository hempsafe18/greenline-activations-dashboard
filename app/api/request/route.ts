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

    // --- NEW: CLIENT TO COMPANY ID MAP ---
    // This tells HubSpot exactly which Company Record to attach the deal to
    const companyMap: Record<string, string> = {
      "3CHI": "49420807771",
      "Plift": "49489562731",
      "Gigli": "49775042420"
    };

    const targetCompanyId = companyMap[client];

    const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;
    
    if (hubspotToken) {
      // 1. Build the base Deal payload
      const payload: any = {
        properties: {
          dealname: `Activation Request: ${storeName} (${client})`,
          description: notificationText,
          pipeline: "883257455", // Keep your existing Pipeline ID here!
          dealstage: "1327057675" // Keep your existing Stage ID here!
        }
      };

      // 2. Automatically associate the Deal with the Company if we have the ID
      if (targetCompanyId) {
        payload.associations = [
          {
            to: { id: targetCompanyId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 5 // In HubSpot, '5' is the secret code for Deal -> Company
              }
            ]
          }
        ];
      }

      // 3. Send to HubSpot
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

    return NextResponse.json({ success: true, message: "Request sent to HubSpot successfully" });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: "Failed to process request" }, { status: 500 });
  }
}

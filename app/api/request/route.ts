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
      await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
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
          }
        })
      });
    }

    // 3. SEND EMAIL NOTIFICATION (Using Resend API)
    const resendToken = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL; // Where you want to receive alerts
    
    if (resendToken && adminEmail) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: "Greenline Alerts <onboarding@resend.dev>", // Resend's default testing address
          to: [adminEmail],
          subject: `🟢 New Activation Request: ${client} - ${storeName}`,
          text: notificationText,
        })
      });
    }

    // Tell the dashboard it was successful
    return NextResponse.json({ success: true, message: "Request processed successfully" });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: "Failed to process request" }, { status: 500 });
  }
}

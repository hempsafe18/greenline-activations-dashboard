import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { google } from 'googleapis';

// Brand to Google Sheets configuration mapping
const sheetsConfig: Record<string, { spreadsheetId: string; sheetName: string }> = {
  "AMIGOS": {
    spreadsheetId: "1WUR_nR0Xo8O8YaNd-D4m3Xg7GzMORsHcRoq1bzfXPMU",
    sheetName: "AMIGOS SPRINT 1 EVENTS"
  },
  "3CHI": {
    spreadsheetId: "1WUR_nR0Xo8O8YaNd-D4m3Xg7GzMORsHcRoq1bzfXPMU",
    sheetName: "3CHI SPRINT 2 EVENTS"
  },
  "MELLOW_FELLOW": {
    spreadsheetId: "1WUR_nR0Xo8O8YaNd-D4m3Xg7GzMORsHcRoq1bzfXPMU",
    sheetName: "MELLOW FELLOW SPRINT 1 EVENTS"
  },
  "GROW": {
    spreadsheetId: process.env.UPCOMING_ACTIVATIONS_SHEET_ID || "",
    sheetName: "Upcoming"
  }
};

async function appendToGoogleSheets(spreadsheetId: string, sheetName: string, values: string[][]): Promise<boolean> {
  try {
    console.log(`[Sheets Debug] Attempting append - Spreadsheet: ${spreadsheetId.substring(0, 20)}..., Sheet: ${sheetName}, Data rows: ${values.length}`);

    const credentialsStr = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentialsStr) {
      console.warn("No Google Sheets credentials found");
      return false;
    }

    const credentials = JSON.parse(credentialsStr);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:L`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    });

    console.log(`[Sheets Debug] Append successful - Updates: ${response.data.updates?.updatedRows || 0} rows`);
    return !!response.data.updates;
  } catch (error) {
    console.error("Google Sheets append error:", error);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
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

    // Append to Google Sheets for the respective brand
    if (client && sheetsConfig[client]) {
      const config = sheetsConfig[client];
      console.log(`[Request] Client: ${client}, Sheet: ${config.sheetName}`);
      if (config.spreadsheetId) {
        // Map to correct columns: Market, Brand, Date, Store Name, Address, Start Time, End Time, Sampling Type, Product Purchase, Products, Pay Rate, Spots
        const values = [[
          '', // Market
          client, // Brand
          date, // Date
          storeName, // Store Name
          address || '', // Address
          startTime || '', // Start Time
          endTime || '', // End Time
          '', // Sampling Type
          '', // Product Purchase
          notes || '', // Products
          '', // Pay Rate
          '' // Spots
        ]];

        const sheetsSuccess = await appendToGoogleSheets(config.spreadsheetId, config.sheetName, values);
        if (!sheetsSuccess) {
          console.warn("Failed to append to Google Sheets, but continuing with notification");
        }
      } else {
        console.warn(`[Request] No spreadsheet ID found for client: ${client}`);
      }
    } else {
      console.warn(`[Request] Client not found or not configured: ${client}`);
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

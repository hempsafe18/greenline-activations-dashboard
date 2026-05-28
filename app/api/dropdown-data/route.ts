import { NextResponse } from 'next/server';
import { google } from 'googleapis';

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
  }
};

async function fetchDropdownData(client: string) {
  try {
    const credentialsStr = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentialsStr) {
      console.warn("No Google Sheets credentials found");
      return null;
    }

    const credentials = JSON.parse(credentialsStr);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const config = sheetsConfig[client];

    if (!config) {
      return null;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `${config.sheetName}!A2:K`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return null;
    }

    const columnIndices = {
      market: 0,
      brand: 1,
      samplingType: 7,
      productPurchase: 8,
      products: 9
    };

    const dropdownData: Record<string, Set<string>> = {
      market: new Set(),
      brand: new Set(),
      samplingType: new Set(),
      productPurchase: new Set(),
      products: new Set()
    };

    rows.forEach((row: string[]) => {
      if (row[columnIndices.market]) dropdownData.market.add(row[columnIndices.market]);
      if (row[columnIndices.brand]) dropdownData.brand.add(row[columnIndices.brand]);
      if (row[columnIndices.samplingType]) dropdownData.samplingType.add(row[columnIndices.samplingType]);
      if (row[columnIndices.productPurchase]) dropdownData.productPurchase.add(row[columnIndices.productPurchase]);
      if (row[columnIndices.products]) dropdownData.products.add(row[columnIndices.products]);
    });

    return {
      market: Array.from(dropdownData.market).sort(),
      brand: Array.from(dropdownData.brand).sort(),
      samplingType: Array.from(dropdownData.samplingType).sort(),
      productPurchase: Array.from(dropdownData.productPurchase).sort(),
      products: Array.from(dropdownData.products).sort()
    };
  } catch (error) {
    console.error("Error fetching dropdown data:", error);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const client = searchParams.get('client');

    if (!client) {
      return NextResponse.json(
        { error: "Client parameter is required" },
        { status: 400 }
      );
    }

    const data = await fetchDropdownData(client);
    if (!data) {
      return NextResponse.json(
        { error: "Failed to fetch dropdown data" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Dropdown data API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

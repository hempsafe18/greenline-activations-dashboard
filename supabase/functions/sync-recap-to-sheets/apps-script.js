/**
 * Greenline Activations — Recap → Sheets sync
 *
 * Deploy steps:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Paste this entire file, replacing any existing code
 * 3. In Apps Script: Project Settings → Script Properties → Add property:
 *      Name:  WEBHOOK_SECRET
 *      Value: (any random string, e.g. "gl-recap-2026-xyz" — must match APPS_SCRIPT_SECRET in Supabase secrets)
 * 4. Click Deploy → New Deployment → Web app
 *      Execute as:  Me
 *      Who has access: Anyone
 * 5. Copy the Web app URL → add it as APPS_SCRIPT_URL in Supabase Edge Function secrets
 */

// Maps Google Sheet header text → recap JSON field name
var HEADER_TO_FIELD = {
  "Timestamp":                        "__timestamp__",
  "Brand Name":                       "brand_name",
  "Store Name":                       "store_name",
  "Store Type":                       "store_type",
  "City":                             "city",
  "Activation Date":                  "activation_date",
  "Shift Start Time":                 "shift_start_time",
  "Shift Start Time ":                "shift_start_time",
  "Shift End Time":                   "shift_end_time",
  "Geo Check-In":                     "geo_checkin",
  "Arrival Status":                   "arrival_status",
  "Late (minutes)":                   "late_minutes",
  "Setup Photo":                      "setup_photo",
  "Shelf Photo":                      "shelf_photo",
  "Engagement photo submission":      "engagement_photos",
  "Engagement Photo Submission":      "engagement_photos",
  "Sampling Type":                    "sampling_type",
  "Products Featured":                "products_featured",
  "Used Tally App":                   "used_tally_app",
  "Tally Screenshot":                 "tally_screenshot",
  "Consumers Approached":             "consumers_approached",
  "Total consumers sampled":          "consumers_sampled",
  "Consumers Sampled":                "consumers_sampled",
  "Estimated units sold":             "estimated_units_sold",
  "Estimated Units Sold":             "estimated_units_sold",
  "Top performing flavor":            "top_performing_flavor",
  "Top Performing Flavor":            "top_performing_flavor",
  "Consumer objections encountered":  "consumer_objections",
  "Consumer Objections":              "consumer_objections",
  "Product in Stock":                 "product_in_stock",
  "Units at Start":                   "units_start",
  "Units at End":                     "units_end",
  "Shelf Placement":                  "shelf_placement",
  "Price Displayed":                  "price_displayed",
  "Promo Signage Present":            "promo_signage_present",
  "Reorder Needed":                   "reorder_needed",
  "Competitor Sampling":              "competitor_sampling",
  "Competitor Details":               "competitor_details",
  "Spoke With Manager":               "spoke_with_manager",
  "Manager Sentiment":                "manager_sentiment",
  "Educated Staff":                   "educated_staff",
  "Future Activations Interest":      "future_activations_interest",
  "Manager Notes":                    "manager_notes",
  "Performance Rating":               "performance_rating",
  "Product Knowledge Rating":         "product_knowledge_rating",
  "Issues Occurred":                  "issues_occurred",
  "Issue Description":                "issue_description",
  "Recommend Account Again":          "recommend_account_again",
  "Reorder Flagged":                  "reorder_flagged",
  "Follow-Up Required":               "followup_required",
  "Follow-Up Description":            "followup_description",
  "Price 10mg 4-Pack":                "price_10mg_4pk",
  "Price 25mg 4-Pack":                "price_25mg_4pk",
  "Price 50mg 4-Pack":                "price_50mg_4pk",
  "Single Cans Offered":              "single_cans_offered",
  "Primary Age Group":                "primary_age_group",
  "Primary Gender":                   "primary_gender"
};

function doPost(e) {
  try {
    // ── Auth check ────────────────────────────────────────────────────────────
    var secret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
    var incoming = e.headers && e.headers["x-webhook-secret"];
    if (secret && incoming !== secret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    var payload = JSON.parse(e.postData.contents);
    var recap   = payload.record || payload.recap || payload;

    if (!recap.brand_name) {
      return jsonResponse({ error: "Missing brand_name in payload" }, 400);
    }

    // ── Find sheet by GID ─────────────────────────────────────────────────────
    var gidStr = String(recap.sheet_gid || "");
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var sheet  = null;

    if (gidStr) {
      var gid = parseInt(gidStr, 10);
      var all = ss.getSheets();
      for (var i = 0; i < all.length; i++) {
        if (all[i].getSheetId() === gid) { sheet = all[i]; break; }
      }
    }

    if (!sheet) {
      return jsonResponse({ error: "Sheet not found for GID: " + gidStr }, 404);
    }

    // ── Build row from headers ─────────────────────────────────────────────────
    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var timestamp = recap.submitted_at
      ? new Date(recap.submitted_at).toLocaleString("en-US")
      : new Date().toLocaleString("en-US");

    var row = headerRow.map(function(header) {
      var field = HEADER_TO_FIELD[header];
      if (!field)                return "";
      if (field === "__timestamp__") return timestamp;
      var val = recap[field];
      return val === null || val === undefined ? "" : String(val);
    });

    sheet.appendRow(row);

    return jsonResponse({ success: true, sheet: sheet.getName(), columns: row.length });

  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function jsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  // Apps Script web apps always return 200; status is in the body for non-200 cases
  return output;
}

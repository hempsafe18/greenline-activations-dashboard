# Grow Dashboard Data Migration Guide

## Problem Fixed

The Grow dashboard wasn't displaying order data (inventory updates, order history) because:
- The **form** saves data to the `sales_visits` table
- The **dashboard API** was reading from the `sales_meeting_recaps` table
- These are two different tables with no connection

## Solution Implemented

### 1. Updated Stats API (`/app/api/grow/stats/route.ts`)

**Changed from:** Reading `sales_meeting_recaps` with complex joins
**Changed to:** Reading `sales_visits` where form data is actually stored

This single change fixes:
- ✅ Order History now displays when visits are submitted
- ✅ Inventory correctly decreases (100 - qty_ordered)
- ✅ Revenue calculations work correctly
- ✅ Accounts list shows actual visit data

### 2. Added Migration Endpoints

Two endpoints can force-push existing order data:

#### Endpoint 1: `/api/grow/seed-data`
**Direct insertion** of the Prudential Club order for immediate testing.

```bash
curl -X POST http://localhost:3000/api/grow/seed-data \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "message": "Prudential Club order added to sales_visits",
  "visit": {
    "id": "...",
    "client_id": "GROW",
    "account_name": "Prudential Club",
    "qty_ordered": 3,
    "line_total": 300,
    "visit_date": "2026-06-04"
  }
}
```

#### Endpoint 2: `/api/grow/migrate-data`
**Bulk migration** of all recaps from `sales_meeting_recaps` to `sales_visits`.

```bash
curl -X POST http://localhost:3000/api/grow/migrate-data \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "message": "Migrated 5 recaps to sales_visits",
  "migrated": 5,
  "total": 15,
  "details": [...]
}
```

## How to Use

### For Development (Local Testing)

1. Start the dev server: `npm run dev`
2. Wait for "Ready" message
3. Call either endpoint with `dev-secret` as the auth token
4. Refresh the Grow dashboard to see updated data

### For Production

1. Set `MIGRATION_SECRET` environment variable to a strong token
2. Call the endpoints with that token as the Bearer token
3. The endpoints will not work without proper authorization

### Expected Results After Migration

After running either endpoint, the dashboard should show:

```
📊 Grow Dashboard Update
├─ Order History: Prudential Club (3 cases, $300)
├─ Accounts: Prudential Club now listed with revenue
├─ Inventory: Decreased from 100 to 97 cases
├─ Revenue: Updated with $300 from Prudential Club order
└─ Commission: 10% of revenue ($30)
```

## Files Changed

- `/app/api/grow/stats/route.ts` - Changed table source from sales_meeting_recaps to sales_visits
- `/app/api/grow/migrate-data/route.ts` - New endpoint for bulk migration
- `/app/api/grow/seed-data/route.ts` - New endpoint for direct data insertion
- `/proxy.ts` - Added new endpoints to public routes

## Verification

To verify the fix works:

1. Submit a new visit via the Grow portal (`/portal/grow`)
2. Check the dashboard - it should immediately show:
   - The order in Order History
   - Updated inventory count
   - Account in Accounts list with revenue
   - Correct commission calculation

No manual migration needed if users continue using the portal form going forward.

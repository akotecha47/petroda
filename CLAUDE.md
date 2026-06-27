# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

No test suite is configured yet.

## Stack

- **React 19** + **Vite 8** (beta) — using `@vitejs/plugin-react` (Babel/Fast Refresh)
- **Tailwind CSS v4** — configured via `@tailwindcss/vite` plugin (no `tailwind.config.js`; import with `@import "tailwindcss"` in CSS)
- **Supabase** (`@supabase/supabase-js`) — client initialized in `src/supabaseClient.js`, exported as `supabase`
- **React Router v7** (`react-router-dom`) — available but not yet wired up
- Supabase URL and anon key must live in `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — never hardcode them

## Project identity

Petroda (MW) Ltd pilot system. 1 station (Mbayani), 1 shift (06:00–18:00), 3 roles. Proof-of-concept build — scope is deliberately constrained. Do not add features beyond what is specified here.

## Roles and permissions

Three roles, enforced via Supabase RLS. Permission boundaries are architectural — not just UI hiding.

- `owner` — config layer. Controls fuel prices, lubricant prices, variance thresholds. Read access to everything. (This is the master/owner role Petroda calls it)
- `admin` — oversight layer. Manages stock, users, customers. Reviews station manager entries. Runs reconciliation. Sees all flags and variances. Generates reports. Issues fuel deliveries to station.
- `manager` — capture layer. Data entry only: daily sales form, fuel deliveries received, morning deposit slip. No access to reconciliation results, flags, or variances — enforced at DB level via RLS, not just hidden in UI.

These map to what Petroda agreed in the meeting as: owner = Master, admin = Admin, manager = Station Manager. Do not rename these in the database. Use these exact strings everywhere in code.

## Terminology

Use **Petrol** and **Diesel** everywhere in the UI. Not PMS or AGO. Database columns may retain technical names — display labels must use plain terms.

## Station configuration — Mbayani

- 2 petrol pumps (pump numbers 1–9 on the form)
- 1 diesel pump (pump numbers 10–19 on the form)
- No paraffin pump — hide paraffin section entirely
- Petrol tank capacity: 40,000L
- Diesel tank capacity: 40,000L
- 1 shift: 06:00–18:00

## The daily sales form — core station manager UI

The station manager screen digitises the physical Petroda daily sales form exactly. Field names and structure stay faithful to the paper form. Do not redesign the data structure — only clean up the presentation.

Three sections:

**1. Meter Readings (per fuel type)**
Per pump: Closing Meter Reading, Opening Meter Reading, Less Pump Test, Out Flow (auto-calculated: closing − opening − pump test). Total Sales and Stock per fuel type. Receipt reference.

Sales built-up per fuel type (petrol and diesel separately):
- Credit Sales: Qty (Ltrs), Rate, Amount
- Petro Card Sales: Qty (Ltrs), Rate, Amount
- Cash Sales: Qty (Ltrs), Rate, Amount

**2. Lubricants Stock and Sales**
32 SKUs (see lubricants table in DB). Per SKU: Opening Stock, Received, Total, Cash Sales Qty, CR Sales Qty, Unit Price, Cash Amount, CR Amount, Closing Stock. Total Sales row at bottom.

**3. Daily Summary + TNM Airtime**
Left column: Fuel Credit Sales, Petro Card Sales, Total, Fuel Cash Sales, Lubs Cash Sales, Airtime, Total Cash, Cash Deposited, Cheques Deposited, Master & Visa Card, Total Deposit, Under/Over Deposit.
Right column (TNM): Opening Balance (MK), Top Up (MK), Total (MK), Closing Balance (MK), Total Sales.

Form footer: Form Completed By (Name + Signature), Form Checked By (Name + Signature).

Station manager submits the completed form by 19:00 each day.

## Deposit slip — next morning entry

The following morning the station manager enters:
- Deposit amount
- Bank name
- Photo upload of physical deposit slip

This triggers auto-reconciliation against the previous day's expected cash total (see reconciliation engines below).

## Dip-to-litre conversion

Each tank has a calibration chart mapping dip-stick depth (cm) to volume (litres). Real dip readings fall between chart rows — use **linear interpolation** between the two nearest cm values.

Store calibration data per tank as rows in a `tank_calibration` table (columns: `tank_id`, `cm`, `litres`).

**Diesel chart — loaded.** 46 points. 2.80 cm = 100L → 243.60 cm = 40,000L.
**Petrol chart — pending clean copy from client.** Build the engine now using diesel; stub petrol until the chart arrives.

Interpolation formula:where C1/L1 and C2/L2 are the rows immediately below and above the measured cm.

## Dip and stock model

Two dip readings per day, taken by the station manager:
- Opening dip — start of the 06:00–18:00 shift
- Closing dip — end of the shift

Each dip reading is in cm and converted to litres via the tank's calibration chart (linear interpolation, already built in `src/lib/dipUtils.js`). Diesel chart is loaded; petrol chart is pending — petrol dips show "chart pending" until the clean chart arrives.

Both opening and closing litres are stored against the day's `daily_sales_form` so reconciliation has both ends of the day. Each day reconciles independently — there is no carry-forward of closing stock to the next day's opening. This avoids cold-start and broken-chain problems.

Fuel stock reconciliation (admin only):
```
book_closing = opening_dip_litres + deliveries_received - total_meter_outflow
fuel_variance = book_closing - closing_dip_litres
```
Flag if `fuel_variance` exceeds the fuel variance threshold set by owner.

## Reconciliation engines — admin only, invisible to station_manager

**1. Fuel stock reconciliation**
- `book_closing = opening_dip_litres + deliveries_received − total_meter_outflow`
- Total outflow per fuel type = sum of (closing meter − opening meter − pump test) across all pumps of that type
- `fuel_variance = book_closing − closing_dip_litres`
- Flag if variance exceeds threshold set by owner

**2. Cash / deposit reconciliation**
- Expected cash = Fuel Cash Sales + Lubs Cash Sales + Airtime Sales
- Runs the morning after when deposit slip is entered
- Actual deposited = deposit slip amount entered by station manager
- Variance = expected − deposited
- Flag if under/over deposit exceeds threshold

Station manager **never sees** either variance. Flags and reconciliation results are admin-only at the RLS level.

## Fuel deliveries

Fuel is dispatched from head office. Station manager records receipt:
- Fuel type (Petrol / Diesel)
- Quantity received (litres)
- Delivery note number
- Date and any additional details

Admin issues the delivery from head office side. Delivery quantity feeds into fuel stock reconciliation as `deliveries received`.

## Customers

~1,400 customer records. Station manager selects from list only — cannot create new customers. Admin can add, edit, and deactivate customers. Customer list import pending — build the selector component with dummy data until the list arrives.

## Lubricant SKUs

32 SKUs on the standard Petroda lubricants form. Prices are configurable by master. Full SKU list is in the DB — do not hardcode SKU names in components.

## What is OUT of scope for this pilot

Do not build:
- Paraffin tracking
- 24-hour shift support
- Multi-station views
- Invoice generation
- Document OCR / upload-and-extract
- Role-specific report formats
- Credit balance tracking beyond recording the sale and customer reference
- Any feature not explicitly listed above

## Pending data from client — stub, do not block

- **Clean petrol calibration chart** — petrol dip engine blocked until received
- **Customer list (~1,400 entries)** — build selector with dummy data
- **Report template** — report generator blocked until received; build the data layer now
- **LPO scope** — unresolved: generate / track / reference-only. Do not build LPO until confirmed in writing.

## Supabase patterns

- Every new table needs RLS enabled + a `service_role` bypass policy + `GRANT` to authenticated role
- `supabaseAdmin` client (service role) must use a separate `storageKey` from the anon client
- Edge Functions read `SERVICE_ROLE_KEY` from environment — never from client bundle
- The `handle_new_user` trigger must not exist — manage auth users explicitly
- Station manager RLS policies must exclude all reconciliation, flag, and variance tables entirely
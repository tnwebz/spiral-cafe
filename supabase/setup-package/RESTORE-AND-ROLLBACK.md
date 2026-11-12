# Spiral Cafe POS — Future Restoration, Credentials & Rollback Guide

This guide details the exact operational procedure for moving Spiral Cafe from the personal development Supabase account to the restaurant owner's dedicated Supabase account.

---

## 1. Prerequisites (When Owner Creates Account)

1. Create a new organization and project in [Supabase](https://supabase.com).
2. Choose the nearest AWS region (e.g. `ap-south-1` Mumbai for India).
3. Record the following credentials from **Project Settings -> API**:
   - **Project URL** (`https://[PROJECT-REF].supabase.co`)
   - **anon / public key** (`eyJhbGci...`)
   - **service_role secret key** (`eyJhbGci...`)

---

## 2. Step-by-Step Restoration Procedure

### Step 1: Pre-Execution Destination Audit
Ensure the destination database is fresh:
```bash
npx tsx supabase/setup-package/scripts/setup.ts --url <NEW_SUPABASE_URL> --key <SERVICE_ROLE_KEY> --dry-run
```
If the destination is clean, 0 application tables will be detected.

### Step 2: Apply the Portable Database Setup
Open **SQL Editor** in the Supabase Dashboard, paste the entire contents of [`spiral-cafe-database-setup.sql`](./spiral-cafe-database-setup.sql), and click **Run**.

Alternatively, modular files can be run in this exact order:
1. `schema/tables.sql`
2. `schema/indexes-constraints.sql`
3. `schema/functions-triggers.sql`
4. `schema/security-rls.sql`
5. `schema/realtime.sql`
6. `seeds/restaurant-config.sql`
7. `seeds/menu-catalog.sql`

### Step 3: Run the Verification Suite
Execute the automated audit:
```bash
npx tsx supabase/setup-package/scripts/verify.ts --url <NEW_SUPABASE_URL> --key <SERVICE_ROLE_KEY>
```
Confirm:
- [x] All 16 tables exist.
- [x] 41 menu items are seeded.
- [x] 15 floor tables are in `AVAILABLE` state.
- [x] Transactional tables (`orders`, `customers`, `sessions`, `invoices`) have **0 rows**.

---

## 3. Initializing Secure Administrator Credentials

The baseline seed initializes a temporary default setup credential. **You must set the owner's permanent credentials immediately upon restoration.**

### Generating a Secure Password Hash
In PostgreSQL / Supabase SQL Editor:
```sql
-- Replace 'YourNewStrongAdminPassword' with the restaurant owner's actual password
update public.cafe_config
set
  admin_username = 'owner',
  admin_password_hash = encode(digest('YourNewStrongAdminPassword', 'sha256'), 'hex'),
  admin_pin = '4921',       -- Master 4-digit PIN for refunds & cancellations
  kitchen_pin = '1122',     -- Kitchen terminal access PIN
  cashier_pin = '3344',     -- Billing register access PIN
  updated_at = now()
where id = 1;
```

---

## 4. Switching the Cloudflare Production Deployment

Only after the destination database is verified:

### Step 1: Update Cloudflare Worker Secrets
Using Wrangler CLI from your local machine:
```bash
cd menu-card

# Put the new service role secret key
npx wrangler secret put SUPABASE_SECRET_KEY
# (Paste the new service_role key when prompted)
```

### Step 2: Update Public Variables
Update the public Supabase URL and anon key in `wrangler.json` (or Cloudflare Dashboard -> Workers & Pages -> Settings -> Variables):
- `NEXT_PUBLIC_SUPABASE_URL = "https://[NEW-PROJECT-REF].supabase.co"`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "eyJhbG..."`

### Step 3: Re-deploy Application
```bash
npm run build:vinext
npx wrangler deploy
```

---

## 5. Post-Switch Production Verification Checklist

1. **Customer QR Ordering**:
   - Open mobile browser to the menu.
   - Enter a test phone number.
   - Verify table selection modal displays all 15 tables in Available status.
   - Submit an order.
2. **Admin Console**:
   - Log in at `/admin/login` using the owner credentials configured in Section 3.
   - Confirm order appears in real time.
   - Accept order and send KOT.
3. **Printer Connector**:
   - Verify local connector pairs with new dashboard origin on `127.0.0.1:4318`.
   - Dispatch a test KOT to kitchen printer (`192.168.1.233:9100`).

---

## 6. Rollback & Disaster Recovery Plan

If any critical issue arises during or after migration:

### Immediate Application Rollback
Switch Cloudflare secrets and variables back to the previous Supabase development project:
```bash
npx wrangler secret put SUPABASE_SECRET_KEY
# (Enter the previous development service role key)
```
Update `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` back to development project reference.

### Clean Partial Restoration
If the setup script failed midway or needs to be re-run from scratch on the owner's project:
```sql
-- DANGER: Run ONLY on the new unpopulated restaurant owner database
drop schema public cascade;
create schema public;
grant all on schema public to postgres;
grant all on schema public to public;
```
Then re-execute [`spiral-cafe-database-setup.sql`](./spiral-cafe-database-setup.sql).

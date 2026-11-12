# Spiral Cafe POS — Supabase Database Setup & Restoration Package

This package contains the complete, portable, and verified database backup needed to initialize the Spiral Cafe restaurant application inside a fresh Supabase project.

---

## Package Directory Structure

```text
supabase/setup-package/
├── spiral-cafe-database-setup.sql    # Complete all-in-one setup SQL script
├── schema/
│   ├── tables.sql                    # 16 Application tables DDL (Foreign-key ordered)
│   ├── indexes-constraints.sql       # Performance indexes & foreign key constraints
│   ├── functions-triggers.sql        # create_order_with_items RPC & updated_at triggers
│   ├── security-rls.sql              # Row Level Security policies
│   └── realtime.sql                  # Supabase Realtime publication setup
├── seeds/
│   ├── menu-catalog.sql              # 41 current menu items across 11 categories
│   └── restaurant-config.sql         # 15 floor tables, cafe profile, and printer settings
├── scripts/
│   ├── setup.ts                      # Automated safe restoration runner
│   ├── verify.ts                     # Live destination database verification suite
│   └── backup-check.ts               # Static integrity and privacy validator
├── reports/
│   ├── schema-inventory.md           # Full inventory of tables, columns, and relations
│   └── migration-validation.md       # Audit and reconciliation report
├── env.example                       # Environment variables template
├── README.md                         # Package overview and quickstart guide
└── RESTORE-AND-ROLLBACK.md           # Step-by-step restoration, rollback & credentials guide
```

---

## Quickstart: Restoring to a New Supabase Project

### Method 1: Via Supabase Dashboard (Recommended — Zero CLI Required)

1. Log into your new Supabase organization: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Create a new project for Spiral Cafe (e.g. `spiral-cafe-prod`).
3. Once the database is provisioned, open **SQL Editor** from the left sidebar.
4. Click **New query**.
5. Copy and paste the entire contents of [`spiral-cafe-database-setup.sql`](./spiral-cafe-database-setup.sql).
6. Click **Run**.
7. The execution takes approximately 2 seconds and will output:
   ```text
   SPIRAL CAFE DATABASE SETUP COMPLETED SUCCESSFULLY!
   Public Tables Created     : 16
   Menu Catalog Items Seeded : 41
   Cafe Config Initialized   : 1
   Floor Tables Ready        : 15
   ```

### Method 2: Via Automated Runner

```bash
# Run dry-run simulation first:
npx tsx supabase/setup-package/scripts/setup.ts --url <NEW_SUPABASE_URL> --key <SERVICE_ROLE_KEY> --dry-run

# Run verification suite after applying:
npx tsx supabase/setup-package/scripts/verify.ts --url <NEW_SUPABASE_URL> --key <SERVICE_ROLE_KEY>
```

---

## Static Validation

You can verify the integrity and privacy compliance of the package anytime by running:

```bash
npx tsx supabase/setup-package/scripts/backup-check.ts
```

All 35 static assertions check for:
- 16 required tables defined.
- Zero customer phone numbers, orders, or sessions in seeds.
- Zero external image URLs or storage links.
- Exact 41 menu items verified.
- 15 floor tables in `AVAILABLE` state.

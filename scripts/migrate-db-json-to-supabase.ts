import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {} as any;
}

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runMigration() {
  const dbJsonPath = path.resolve(process.cwd(), "src/data/db.json");
  if (!fs.existsSync(dbJsonPath)) {
    console.error("src/data/db.json not found at:", dbJsonPath);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dbJsonPath, "utf-8");
  const data = JSON.parse(rawData);

  console.log("Starting idempotent migration from db.json to Supabase PostgreSQL...\n");

  // 1. CAFE CONFIG
  if (data.config) {
    console.log("Migrating cafe_config...");
    const cfg = data.config;
    const { error } = await supabase.from("cafe_config").upsert(
      {
        id: 1,
        tax_percentage: cfg.taxPercentage ?? 5,
        packaging_fee: cfg.packagingFee ?? 0,
        service_charge: cfg.serviceCharge ?? 0,
        kitchen_pin: cfg.kitchenPin ?? "1234",
        cashier_pin: cfg.cashierPin ?? "5678",
        admin_pin: cfg.adminPin ?? "1234",
        admin_username: cfg.adminUsername ?? "admin",
        admin_password_hash: cfg.adminPasswordHash,
        cafe_name: cfg.cafeName ?? "Spiral Cafe",
        cafe_address: cfg.cafeAddress ?? "",
        cafe_phone: cfg.cafePhone ?? "",
        gst_number: cfg.gstNumber ?? "",
        currency_symbol: cfg.currencySymbol ?? "₹",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) console.error("Error migrating cafe_config:", error.message);
    else console.log("✓ cafe_config migrated successfully.");
  }

  // 2. MENU ITEMS
  if (Array.isArray(data.menuItems) && data.menuItems.length > 0) {
    console.log(`Migrating ${data.menuItems.length} menu items...`);
    const mappedMenuItems = data.menuItems.map((m: any) => ({
      id: m.id,
      name: m.name,
      description: m.description || "",
      price: m.price,
      original_price: m.originalPrice || null,
      category_id: m.categoryId,
      category_name: m.categoryName,
      diet_type: m.dietType || "veg",
      badge: m.badge || "none",
      rating: m.rating || 4.8,
      reviews_count: m.reviewsCount || 250,
      image: m.image,
      cloudinary_public_id: m.cloudinaryPublicId || null,
      available: m.available ?? true,
      created_at: m.createdAt || new Date().toISOString(),
      updated_at: m.updatedAt || new Date().toISOString(),
    }));

    const { error } = await supabase.from("menu_items").upsert(mappedMenuItems, { onConflict: "id" });
    if (error) console.error("Error migrating menu_items:", error.message);
    else console.log(`✓ ${mappedMenuItems.length} menu items migrated successfully.`);
  }

  // 3. CUSTOMERS
  if (Array.isArray(data.customers) && data.customers.length > 0) {
    console.log(`Migrating ${data.customers.length} customers...`);
    const mappedCustomers = data.customers.map((c: any) => ({
      id: c.id,
      phone_number: c.phoneNumber,
      name: c.name || null,
      service_sms_consent: c.serviceSmsConsent ?? true,
      marketing_consent: c.marketingConsent ?? false,
      total_orders: c.totalOrders || 0,
      total_spent: c.totalSpent || 0,
      first_seen_at: c.firstSeenAt || new Date().toISOString(),
      last_seen_at: c.lastSeenAt || new Date().toISOString(),
      created_at: c.createdAt || new Date().toISOString(),
      updated_at: c.updatedAt || new Date().toISOString(),
    }));

    const { error } = await supabase.from("customers").upsert(mappedCustomers, { onConflict: "id" });
    if (error) console.error("Error migrating customers:", error.message);
    else console.log(`✓ ${mappedCustomers.length} customers migrated successfully.`);
  }

  // 4. CUSTOMER SESSIONS
  if (Array.isArray(data.customerSessions) && data.customerSessions.length > 0) {
    console.log(`Migrating ${data.customerSessions.length} customer sessions...`);
    const mappedSessions = data.customerSessions.map((s: any) => ({
      id: s.id,
      customer_id: s.customerId || null,
      customer_phone: s.customerPhone || null,
      table_number: s.tableNumber || "Takeout",
      session_token: s.sessionToken,
      started_at: s.startedAt || new Date().toISOString(),
      last_active_at: s.lastActiveAt || new Date().toISOString(),
    }));

    const { error } = await supabase.from("customer_sessions").upsert(mappedSessions, { onConflict: "id" });
    if (error) console.error("Error migrating customer_sessions:", error.message);
    else console.log(`✓ ${mappedSessions.length} customer sessions migrated successfully.`);
  }

  // 5. ORDERS & 6. ORDER ITEMS
  if (Array.isArray(data.orders) && data.orders.length > 0) {
    console.log(`Migrating ${data.orders.length} orders...`);
    const mappedOrders: any[] = [];
    const mappedOrderItems: any[] = [];

    data.orders.forEach((o: any) => {
      mappedOrders.push({
        id: o.id,
        order_number: o.orderNumber,
        table_number: o.tableNumber || "Table 01",
        customer_session_id: o.customerSessionId || null,
        customer_id: o.customerId || null,
        customer_phone: o.customerPhone || null,
        subtotal: o.subtotal || 0,
        tax: o.tax || 0,
        packaging_fee: o.packagingFee || 0,
        service_charge: o.serviceCharge || 0,
        grand_total: o.grandTotal || 0,
        status: o.status || "PENDING",
        payment_status: o.paymentStatus || "UNPAID",
        payment_method: o.paymentMethod || "UNSELECTED",
        payment_txn_id: o.paymentTxnId || null,
        payment_provider: o.paymentProvider || null,
        invoice_id: o.invoiceId || null,
        invoice_number: o.invoiceNumber || null,
        notes: o.notes || "",
        created_at: o.createdAt || new Date().toISOString(),
        updated_at: o.updatedAt || new Date().toISOString(),
        preparing_at: o.preparingAt || null,
        ready_at: o.readyAt || null,
        paid_at: o.paidAt || null,
        completed_at: o.completedAt || null,
        cancelled_at: o.cancelledAt || null,
      });

      if (Array.isArray(o.items)) {
        o.items.forEach((it: any, idx: number) => {
          mappedOrderItems.push({
            id: it.id || `${o.id}_item_${idx}`,
            order_id: o.id,
            product_id: it.productId || null,
            name: it.name,
            price: it.price || 0,
            quantity: it.quantity || 1,
            line_total: it.lineTotal || (it.price * (it.quantity || 1)),
            image: it.image || "",
            notes: it.notes || null,
          });
        });
      }
    });

    const { error: orderError } = await supabase.from("orders").upsert(mappedOrders, { onConflict: "id" });
    if (orderError) console.error("Error migrating orders:", orderError.message);
    else console.log(`✓ ${mappedOrders.length} orders migrated successfully.`);

    if (mappedOrderItems.length > 0) {
      console.log(`Migrating ${mappedOrderItems.length} order items...`);
      const { error: itemsError } = await supabase.from("order_items").upsert(mappedOrderItems, { onConflict: "id" });
      if (itemsError) console.error("Error migrating order_items:", itemsError.message);
      else console.log(`✓ ${mappedOrderItems.length} order items migrated successfully.`);
    }
  }

  // 7. INVOICES & 8. INVOICE ITEMS
  if (Array.isArray(data.invoices) && data.invoices.length > 0) {
    console.log(`Migrating ${data.invoices.length} invoices...`);
    const mappedInvoices: any[] = [];
    const mappedInvoiceItems: any[] = [];

    data.invoices.forEach((inv: any) => {
      mappedInvoices.push({
        id: inv.id,
        invoice_number: inv.invoiceNumber,
        order_id: inv.orderId || null,
        order_number: inv.orderNumber,
        table_number: inv.tableNumber || "Takeout",
        customer_id: inv.customerId || null,
        customer_phone: inv.customerPhone || null,
        items: inv.items || [],
        subtotal: inv.subtotal || 0,
        tax: inv.tax || 0,
        packaging_fee: inv.packagingFee || 0,
        service_charge: inv.serviceCharge || 0,
        grand_total: inv.grandTotal || 0,
        payment_method: inv.paymentMethod || "UNSELECTED",
        payment_status: inv.paymentStatus || "UNPAID",
        paid_at: inv.paidAt || null,
        secure_token: inv.secureToken || null,
        sms_sent: inv.smsSent ?? false,
        sms_sent_at: inv.smsSentAt || null,
        notes: inv.notes || null,
        created_at: inv.createdAt || new Date().toISOString(),
      });

      if (Array.isArray(inv.items)) {
        inv.items.forEach((it: any, idx: number) => {
          mappedInvoiceItems.push({
            id: `${inv.id}_item_${idx}`,
            invoice_id: inv.id,
            product_id: it.productId || null,
            name: it.name,
            quantity: it.quantity || 1,
            unit_price: it.unitPrice || (it.price || 0),
            line_total: it.lineTotal || ((it.unitPrice || it.price || 0) * (it.quantity || 1)),
          });
        });
      }
    });

    const { error: invError } = await supabase.from("invoices").upsert(mappedInvoices, { onConflict: "id" });
    if (invError) console.error("Error migrating invoices:", invError.message);
    else console.log(`✓ ${mappedInvoices.length} invoices migrated successfully.`);

    if (mappedInvoiceItems.length > 0) {
      const { error: invItemsError } = await supabase.from("invoice_items").upsert(mappedInvoiceItems, { onConflict: "id" });
      if (invItemsError) console.error("Error migrating invoice_items:", invItemsError.message);
      else console.log(`✓ ${mappedInvoiceItems.length} invoice items migrated successfully.`);
    }
  }

  // 9. SETTLEMENTS
  if (Array.isArray(data.settlements) && data.settlements.length > 0) {
    console.log(`Migrating ${data.settlements.length} settlements...`);
    const mappedSettlements = data.settlements.map((stl: any) => ({
      id: stl.id,
      date: stl.date,
      total_orders: stl.totalOrders || 0,
      total_sales: stl.totalSales || 0,
      cash_sales: stl.cashSales || 0,
      online_sales: stl.onlineSales || 0,
      cash_counted: stl.cashCounted || 0,
      cash_settled: stl.cashSettled || 0,
      difference: stl.difference || 0,
      notes: stl.notes || null,
      settled_by: stl.settledBy || "Admin",
      settled_at: stl.settledAt || new Date().toISOString(),
    }));

    const { error } = await supabase.from("settlements").upsert(mappedSettlements, { onConflict: "id" });
    if (error) console.error("Error migrating settlements:", error.message);
    else console.log(`✓ ${mappedSettlements.length} settlements migrated successfully.`);
  }

  // 10. AUDIT LOGS
  if (Array.isArray(data.auditLogs) && data.auditLogs.length > 0) {
    console.log(`Migrating ${data.auditLogs.length} audit logs...`);
    const mappedLogs = data.auditLogs.map((log: any) => ({
      id: log.id,
      admin_user: log.adminUser || "system",
      action: log.action || "UNKNOWN",
      entity_type: log.entityType || "SYSTEM",
      entity_id: log.entityId || "",
      details: log.details || "",
      previous_value: log.previousValue || null,
      new_value: log.newValue || null,
      timestamp: log.timestamp || new Date().toISOString(),
    }));

    const { error } = await supabase.from("audit_logs").upsert(mappedLogs, { onConflict: "id" });
    if (error) console.error("Error migrating audit_logs:", error.message);
    else console.log(`✓ ${mappedLogs.length} audit logs migrated successfully.`);
  }

  console.log("\nMigration completed successfully!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

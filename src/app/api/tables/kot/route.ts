import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrderById } from "@/lib/db";
import { buildKotData, KotReceiptEngine } from "@/lib/kot";
import { getPrinterSettings } from "@/lib/tables";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { action, orderId, round = 1, adminUser = "Staff", errorMessage } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required." },
        { status: 400 }
      );
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    const currentNotes = order.notes || "";
    const now = new Date().toISOString();

    // 1. CONFIRM SUCCESSFUL PRINT
    if (action === "CONFIRM_PRINT") {
      // Parse existing confirmed rounds
      const match = currentNotes.match(/\[KOT_CONFIRMED_ROUNDS:([0-9,]+)\]/);
      let confirmedRounds: number[] = match
        ? match[1]
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n))
        : [];

      if (!confirmedRounds.includes(round)) {
        confirmedRounds.push(round);
      }

      // Clean old warning flags and append confirmed rounds
      let cleanNotes = currentNotes
        .replace(/\[KOT_CONFIRMED_ROUNDS:[0-9,]+\]/g, "")
        .replace(/\[KOT_FAILED[^\]]*\]/g, "")
        .replace(/\[KOT_UNKNOWN[^\]]*\]/g, "")
        .replace(/\[KOT_VIEWED[^\]]*\]/g, "")
        .replace(/\[KOT_EXITED_WITHOUT_KOT[^\]]*\]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      cleanNotes = `${cleanNotes} [KOT_CONFIRMED_ROUNDS:${confirmedRounds.join(",")}] [KOT_CONFIRMED_AT:${now}]`.trim();

      const updatePayload: any = {
        notes: cleanNotes,
        updated_at: now,
      };

      if (order.status === "PENDING") {
        updatePayload.status = "PREPARING";
        updatePayload.preparing_at = now;
      }

      const { error: updateError } = await supabaseAdmin.from("orders").update(updatePayload).eq("id", orderId);
      if (updateError) {
        console.error("Failed to update order notes for KOT confirmation:", updateError);
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }

      // Record print attempt
      try {
        await supabaseAdmin.from("print_attempts" as any).insert({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          kot_id: `KOT-${order.orderNumber.replace(/^[A-Za-z]+-/, "")}-${String(round).padStart(2, "0")}`,
          order_id: orderId,
          table_number: order.tableNumber,
          round,
          printer_model: "CN811-UEWB",
          attempt_type: "PRINT",
          status: "SUCCESS",
          error_message: null,
          created_at: now,
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `KOT Round ${round} successfully confirmed. Kitchen notified.`,
        confirmedRounds,
      });
    }

    // 2. MARK PRINT FAILED (Printer unreachable or paper out)
    if (action === "MARK_FAILED" || action === "REPORT_FAILURE") {
      let cleanNotes = currentNotes
        .replace(/\[KOT_FAILED\]/g, "")
        .replace(/\[KOT_UNKNOWN\]/g, "")
        .trim();

      cleanNotes = `${cleanNotes} [KOT_FAILED] [KOT_FAILED_AT:${now}]`.trim();

      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({ notes: cleanNotes, updated_at: now })
        .eq("id", orderId);

      if (updateError) {
        console.error("Failed to update order notes for KOT failure:", updateError);
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }

      try {
        await supabaseAdmin.from("print_attempts" as any).insert({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          kot_id: `KOT-${order.orderNumber.replace(/^[A-Za-z]+-/, "")}-${String(round).padStart(2, "0")}`,
          order_id: orderId,
          table_number: order.tableNumber,
          round,
          printer_model: "CN811-UEWB",
          attempt_type: "PRINT",
          status: "FAILED",
          error_message: errorMessage || "Printer unreachable",
          created_at: now,
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: "KOT marked as failed. Manual action required.",
      });
    }

    // 3. MARK PRINT UNKNOWN (Connection dropped during transmission)
    if (action === "MARK_UNKNOWN") {
      let cleanNotes = currentNotes
        .replace(/\[KOT_FAILED\]/g, "")
        .replace(/\[KOT_UNKNOWN\]/g, "")
        .trim();

      cleanNotes = `${cleanNotes} [KOT_UNKNOWN] [KOT_UNKNOWN_AT:${now}]`.trim();

      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({ notes: cleanNotes, updated_at: now })
        .eq("id", orderId);

      if (updateError) {
        console.error("Failed to update order notes for KOT failure:", updateError);
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "KOT print outcome unknown. Please verify with kitchen.",
      });
    }

    // 4. MARK MANUALLY DELIVERED (Staff wrote order on notepad)
    if (action === "MARK_MANUAL" || action === "MARK_HANDOFF") {
      let cleanNotes = currentNotes
        .replace(/\[KOT_FAILED[^\]]*\]/g, "")
        .replace(/\[KOT_UNKNOWN[^\]]*\]/g, "")
        .replace(/\[KOT_VIEWED[^\]]*\]/g, "")
        .replace(/\[KOT_EXITED_WITHOUT_KOT[^\]]*\]/g, "")
        .replace(/\[KOT_MANUALLY_DELIVERED[^\]]*\]/g, "")
        .replace(/\[KOT_MANUAL_[^\]]*\]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      cleanNotes = `${cleanNotes} [KOT_MANUALLY_DELIVERED] [KOT_MANUAL_BY:${adminUser}] [KOT_MANUAL_AT:${now}]`.trim();

      const updatePayload: any = {
        notes: cleanNotes,
        updated_at: now,
      };

      if (order.status === "PENDING") {
        updatePayload.status = "PREPARING";
        updatePayload.preparing_at = now;
      }

      const { error: updateError } = await supabaseAdmin.from("orders").update(updatePayload).eq("id", orderId);
      if (updateError) {
        console.error("Failed to update order notes for KOT confirmation:", updateError);
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Order marked as manually delivered to kitchen.",
      });
    }

    // 5. PREPARE KOT PAYLOAD
    if (action === "PREPARE_KOT") {
      const printerSettings = await getPrinterSettings();
      const kotData = buildKotData(order, round, printerSettings.terminalName);
      const plainSlip = KotReceiptEngine.formatPlainSlip(kotData);
      const escPosCommands = KotReceiptEngine.generateEscPosCommands(kotData);

      return NextResponse.json({
        success: true,
        kotData,
        plainSlip,
        escPosCommands,
        printerSettings,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid KOT action." }, { status: 400 });
  } catch (err: any) {
    console.error("KOT API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process KOT action." },
      { status: 500 }
    );
  }
}


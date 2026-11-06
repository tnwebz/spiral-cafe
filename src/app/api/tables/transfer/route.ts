import { NextRequest, NextResponse } from "next/server";
import {
  requestTableTransfer,
  approveTransferRequest,
  rejectTransferRequest,
  adminManualTransfer,
  getPendingTransferRequests,
  getActiveCustomerVisit,
  readLocalTransfers,
} from "@/lib/tables";
import { requireAdminAuth } from "@/lib/auth";

/**
 * GET: Retrieve pending transfer requests for admin, or active customer transfer status
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const phone = searchParams.get("phone");

    if (sessionId || phone) {
      // Check customer active transfer request or active visit
      const transfers = readLocalTransfers();
      const myRequest = transfers.find(
        (t) =>
          (sessionId && t.customerSessionId === sessionId && t.status === "PENDING") ||
          (phone && t.customerPhone === phone && t.status === "PENDING")
      );

      const activeVisit = await getActiveCustomerVisit(sessionId || "", phone || undefined);

      return NextResponse.json({
        success: true,
        pendingRequest: myRequest || null,
        activeVisit,
      });
    }

    // Default: Admin fetches all pending requests (Requires Admin Authentication)
    const authError = await requireAdminAuth(req);
    if (authError) return authError;

    const pending = await getPendingTransferRequests();
    return NextResponse.json({
      success: true,
      pendingRequests: pending,
    });
  } catch (err: any) {
    console.error("GET table transfer error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch table transfers." },
      { status: 500 }
    );
  }
}

/**
 * POST: Dispatch transfer actions: REQUEST, APPROVE, REJECT, MANUAL, CHECK_ACTIVE
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = (body.action || "REQUEST").toUpperCase();

    // Sensitive Admin Actions Require Authorization
    if (action === "APPROVE" || action === "REJECT" || action === "MANUAL") {
      const authError = await requireAdminAuth(req);
      if (authError) return authError;
    }

    // 1. APPROVE TRANSFER (Admin)
    if (action === "APPROVE") {
      const { requestId, adminUser = "Admin Staff" } = body;
      if (!requestId) {
        return NextResponse.json(
          { success: false, error: "requestId is required to approve." },
          { status: 400 }
        );
      }
      const result = await approveTransferRequest(requestId, adminUser);
      return NextResponse.json({
        success: true,
        message: `Table transfer approved. Orders moved to Table ${result.toTable}.`,
        result,
      });
    }

    // 2. REJECT TRANSFER (Admin)
    if (action === "REJECT") {
      const { requestId, reason = "Declined by counter", adminUser = "Admin Staff" } = body;
      if (!requestId) {
        return NextResponse.json(
          { success: false, error: "requestId is required to reject." },
          { status: 400 }
        );
      }
      const updated = await rejectTransferRequest(requestId, reason, adminUser);
      return NextResponse.json({
        success: true,
        message: "Table transfer request rejected.",
        request: updated,
      });
    }

    // 3. MANUAL STAFF TRANSFER (Admin direct move)
    if (action === "MANUAL") {
      const { fromTable, toTable, adminUser = "Admin Counter" } = body;
      if (!fromTable || !toTable) {
        return NextResponse.json(
          { success: false, error: "fromTable and toTable are required." },
          { status: 400 }
        );
      }
      const result = await adminManualTransfer({ fromTable, toTable, adminUser });
      return NextResponse.json({
        success: true,
        message: `Successfully transferred Table ${fromTable} to Table ${toTable}.`,
        result,
      });
    }

    // 4. CHECK ACTIVE VISIT CONFLICT
    if (action === "CHECK_ACTIVE") {
      const { customerSessionId, customerPhone } = body;
      const activeVisit = await getActiveCustomerVisit(customerSessionId || "", customerPhone);
      return NextResponse.json({
        success: true,
        activeVisit,
      });
    }

    // 5. CUSTOMER REQUEST TRANSFER (Default)
    const { fromTable, toTable, customerSessionId, customerPhone } = body;
    if (!fromTable || !toTable) {
      return NextResponse.json(
        { success: false, error: "fromTable and toTable are required." },
        { status: 400 }
      );
    }

    if (!customerSessionId) {
      return NextResponse.json(
        { success: false, error: "customerSessionId is required." },
        { status: 400 }
      );
    }

    const transferResult = await requestTableTransfer({
      fromTable,
      toTable,
      customerSessionId,
      customerPhone,
    });

    return NextResponse.json(transferResult);
  } catch (err: any) {
    console.error("POST table transfer error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process table transfer." },
      { status: 400 }
    );
  }
}

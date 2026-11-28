import { Order, OrderItem, getOrderById } from "./db";
import { supabaseAdmin } from "./supabase/admin";

export interface KotData {
  kotId: string;
  orderId: string;
  orderNumber: string;
  tableNumber: string;
  round: number;
  terminalName?: string;
  dateStr: string;
  timeStr: string;
  isPrivateOrder?: boolean;
  privatePurpose?: string;
  isTakeaway?: boolean;
  isMixed?: boolean;
  items: Array<{
    name: string;
    quantity: number;
    notes?: string;
  }>;
  totalItems: number;
  totalQuantity: number;
  specialInstructions?: string;
}

/**
 * High-visibility, de-cluttered KOT Receipt Engine
 * Width: 48 columns (80mm CN811-UEWB) or 32 columns (58mm POS58 Counter)
 */
export class KotReceiptEngine {
  private static LINE_WIDTH = 48;

  static formatLine(left: string, right: string, width = this.LINE_WIDTH): string {
    const spaceCount = Math.max(1, width - left.length - right.length);
    return `${left}${" ".repeat(spaceCount)}${right}`;
  }

  private static wrapText(text: string, maxWidth: number): string[] {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if (!currentLine) {
        if (word.length <= maxWidth) {
          currentLine = word;
        } else {
          let rem = word;
          while (rem.length > maxWidth) {
            lines.push(rem.substring(0, maxWidth));
            rem = rem.substring(maxWidth);
          }
          currentLine = rem;
        }
      } else {
        if ((currentLine + " " + word).length <= maxWidth) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          if (word.length <= maxWidth) {
            currentLine = word;
          } else {
            let rem = word;
            while (rem.length > maxWidth) {
              lines.push(rem.substring(0, maxWidth));
              rem = rem.substring(maxWidth);
            }
            currentLine = rem;
          }
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines.length > 0 ? lines : [text.substring(0, maxWidth)];
  }

  static formatPlainSlip(data: KotData, width = this.LINE_WIDTH): string {
    const divider = "-".repeat(width);

    const lines: string[] = [];
    if (data.isPrivateOrder) {
      const purposeClean = data.privatePurpose
        ? ` (${String(data.privatePurpose).toUpperCase().replace(/_/g, " ")})`
        : "";
      lines.push(`*** PRIVATE ORDER${purposeClean} ***`);
    }
    lines.push(`Table No: ${data.tableNumber}`);

    const dateTimeStr = data.timeStr
      ? `${(data.dateStr || "").replace(/-/g, "/")} ${data.timeStr.toLowerCase()}`
      : (data.dateStr || "").replace(/-/g, "/");
    if (width >= 44 && data.orderNumber) {
      lines.push(this.formatLine(`Date: ${dateTimeStr}`, `Order: #${data.orderNumber}`, width));
    } else {
      lines.push(`Date: ${dateTimeStr}`);
      if (data.orderNumber && data.isPrivateOrder) {
        lines.push(`Order: #${data.orderNumber}`);
      }
    }
    lines.push(`Terminal : ${data.terminalName || "Billing 1"}`);

    if (data.round && data.round > 1) {
      lines.push(`Round: ${data.round} (Add-on)`);
    }

    lines.push(divider);
    lines.push(this.formatLine("ITEM", "QTY", width));
    lines.push(divider);

    data.items.forEach((item) => {
      const isItemParcel =
        item.name.toLowerCase().includes("(parcel)") ||
        (item.notes || "").toLowerCase().includes("parcel") ||
        String(data.tableNumber).toUpperCase() === "TAKEAWAY";
      const cleanName = item.name
        .replace(/\s*-\s*\(parcel\)/gi, "")
        .replace(/\s*-\s*\(dine in\)/gi, "")
        .replace(/\s*\(parcel\)/gi, "")
        .replace(/\s*\(dine in\)/gi, "")
        .replace(/\s*\[parcel\]/gi, "")
        .replace(/\s*\[dine in\]/gi, "")
        .trim();
      const displayName = data.isPrivateOrder
        ? isItemParcel
          ? `${cleanName} - (Parcel)`
          : cleanName
        : isItemParcel
        ? `${cleanName} - (Parcel)`
        : `${cleanName} - (Dine In)`;
      const qtyStr = String(item.quantity);
      const maxFirstLine = width - qtyStr.length - 1;
      const wrapped = this.wrapText(displayName, maxFirstLine);
      const firstLine = wrapped[0] || displayName.substring(0, maxFirstLine);
      lines.push(this.formatLine(firstLine, qtyStr, width));
      for (let i = 1; i < wrapped.length; i++) {
        lines.push(wrapped[i]);
      }

      // Print legitimate kitchen customization notes
      if (item.notes) {
        const cleanNote = item.notes
          .replace(/\[[^\]]+\]/g, "")
          .replace(/dine-?in\s*(serve\s*first)?/gi, "")
          .replace(/parcel\s*(for\s*takeaway)?/gi, "")
          .trim();
        if (cleanNote) {
          lines.push(`  + ${cleanNote}`);
        }
      }
    });

    lines.push(divider);
    lines.push(this.formatLine(`Total Items: ${data.totalItems}`, `Total Qty: ${data.totalQuantity}`, width));

    if (data.specialInstructions && data.specialInstructions.trim()) {
      const cleanInst = data.specialInstructions.trim().replace(/^"+|"+$/g, "");
      lines.push(divider);
      lines.push("Special Request:");
      lines.push(`"${cleanInst}"`);
    }

    return lines.join("\n");
  }

  /**
   * Generates standard ESC/POS binary command string (48 cols for 80mm kitchen, 32 cols for 58mm counter)
   */
  static generateEscPosCommands(data: KotData, width = this.LINE_WIDTH): string {
    const ESC = "\x1B";
    const GS = "\x1D";
    const divider = "-".repeat(width) + "\n";

    let commands = "";

    // 1. Initialize printer
    commands += `${ESC}@`;

    // 2. Set character code page to standard PC437, Font A (12x24), Normal 1x1 size, Left align
    commands += `${ESC}t\x00`;
    commands += `${ESC}M\x00`; // Standard Font A
    commands += `${ESC}2`;     // Default line spacing
    commands += `${ESC}a\x00`; // Align Left

    // 2b. Private order banner if applicable
    if (data.isPrivateOrder) {
      const purposeClean = data.privatePurpose
        ? ` (${String(data.privatePurpose).toUpperCase().replace(/_/g, " ")})`
        : "";
      commands += `${ESC}a\x01`;
      commands += `${GS}B\x01`;
      commands += `${ESC}E\x01`;
      commands += ` *** PRIVATE ORDER${purposeClean} *** \n`;
      commands += `${GS}B\x00`;
      commands += `${ESC}E\x00`;
      commands += `${ESC}a\x00`;
    }

    // 3. Table No: <tableNumber> (Bold, proportional Double size GS ! 0x11 when fits)
    const tableHeading = `Table No: ${data.tableNumber}`;
    commands += `${ESC}E\x01`;
    if (tableHeading.length * 2 <= width) {
      commands += `${GS}!\x11`;
      commands += `${tableHeading}\n`;
      commands += `${GS}!\x00`;
    } else {
      commands += `${tableHeading}\n`;
    }
    commands += `${ESC}E\x00`;

    // 4. Date & Terminal (Normal size 1x1)
    const dateTimeStr = data.timeStr
      ? `${(data.dateStr || "").replace(/-/g, "/")} ${data.timeStr.toLowerCase()}`
      : (data.dateStr || "").replace(/-/g, "/");
    if (width >= 44 && data.orderNumber) {
      commands += `${this.formatLine(`Date: ${dateTimeStr}`, `Order: #${data.orderNumber}`, width)}\n`;
    } else {
      commands += `Date: ${dateTimeStr}\n`;
    }
    commands += `Terminal : ${data.terminalName || "Billing 1"}\n`;

    if (data.round && data.round > 1) {
      commands += `Round: ${data.round} (Add-on)\n`;
    }

    // 5. Divider
    commands += divider;

    // 6. Header: ITEM                         QTY (Bold)
    commands += `${ESC}E\x01`;
    commands += `${this.formatLine("ITEM", "QTY", width)}\n`;
    commands += `${ESC}E\x00`;
    commands += divider;

    // 7. Items in Bold
    data.items.forEach((item) => {
      const isItemParcel =
        item.name.toLowerCase().includes("(parcel)") ||
        (item.notes || "").toLowerCase().includes("parcel") ||
        String(data.tableNumber).toUpperCase() === "TAKEAWAY";
      const cleanName = item.name
        .replace(/\s*-\s*\(parcel\)/gi, "")
        .replace(/\s*-\s*\(dine in\)/gi, "")
        .replace(/\s*\(parcel\)/gi, "")
        .replace(/\s*\(dine in\)/gi, "")
        .replace(/\s*\[parcel\]/gi, "")
        .replace(/\s*\[dine in\]/gi, "")
        .trim();
      const displayName = data.isPrivateOrder
        ? isItemParcel
          ? `${cleanName} - (Parcel)`
          : cleanName
        : isItemParcel
        ? `${cleanName} - (Parcel)`
        : `${cleanName} - (Dine In)`;

      commands += `${ESC}!\x00`; // Reset print mode: Font A, 1x1, un-stretched
      commands += `${ESC}M\x00`; // Font A
      commands += `${GS}!\x00`;  // Normal size (1x width, 1x height)
      commands += `${ESC}E\x01`; // Bold ON
      commands += `${ESC}G\x01`; // Double-strike ON (thicker bold)
      const qtyStr = String(item.quantity);
      const maxFirstLine = width - qtyStr.length - 1;
      const wrapped = this.wrapText(displayName, maxFirstLine);
      const firstLine = wrapped[0] || displayName.substring(0, maxFirstLine);
      commands += `${this.formatLine(firstLine, qtyStr, width)}\n`;
      for (let i = 1; i < wrapped.length; i++) {
        commands += `${wrapped[i]}\n`;
      }
      commands += `${ESC}G\x00`; // Double-strike OFF
      commands += `${ESC}E\x00`; // Bold OFF

      if (item.notes) {
        const cleanNote = item.notes
          .replace(/\[[^\]]+\]/g, "")
          .replace(/dine-?in\s*(serve\s*first)?/gi, "")
          .replace(/parcel\s*(for\s*takeaway)?/gi, "")
          .trim();
        if (cleanNote) {
          commands += `  + ${cleanNote}\n`;
        }
      }
    });

    // 8. Divider
    commands += divider;

    // 9. Total Items: X       Total Qty: Y (Bold, Font A 1x1 un-stretched)
    commands += `${ESC}!\x00`;
    commands += `${ESC}M\x00`;
    commands += `${GS}!\x00`;
    commands += `${ESC}E\x01`;
    commands += `${ESC}G\x01`;
    commands += `${this.formatLine(`Total Items: ${data.totalItems}`, `Total Qty: ${data.totalQuantity}`, width)}\n`;
    commands += `${ESC}G\x00`;
    commands += `${ESC}E\x00`;

    if (data.specialInstructions && data.specialInstructions.trim()) {
      const cleanInst = data.specialInstructions.trim().replace(/^"+|"+$/g, "");
      commands += divider;
      commands += `${ESC}!\x00`;
      commands += `${ESC}M\x00`;
      commands += `${GS}!\x00`;
      commands += `${ESC}E\x01`;
      commands += `${ESC}G\x01`;
      commands += `Special Request:\n`;
      commands += `${ESC}G\x00`;
      commands += `${ESC}E\x00`;
      commands += `"${cleanInst}"\n`;
    }

    // Minimal paper feed (2 lines) and cut
    commands += `${ESC}d\x02`;
    commands += `${GS}V\x42\x00`;

    return commands;
  }
}

/**
 * Filter items by round. If round is specified, returns only items belonging to that round.
 * If no round items found (e.g. legacy order without round tag), returns all items.
 */
export function filterItemsForRound(items: OrderItem[], targetRound: number): OrderItem[] {
  const roundItems = items.filter((it) => {
    const match = (it.notes || "").match(/\[ROUND:(\d+)\]/);
    const r = match ? parseInt(match[1], 10) : (it.round || 1);
    return r === targetRound;
  });

  if (roundItems.length > 0) return roundItems;
  return targetRound === 1 ? items : [];
}

/**
 * Prepare KOT Data object from an order and target round
 */
export function buildKotData(
  order: Order,
  targetRound = 1,
  terminalName = "Billing 1",
  options?: { isPrivateOrder?: boolean; isTakeaway?: boolean }
): KotData {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const roundItems = filterItemsForRound(order.items, targetRound);
  const itemsToPrint = roundItems.length > 0 ? roundItems : order.items;

  const totalQuantity = itemsToPrint.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const totalItems = itemsToPrint.length;

  const shortOrderId = order.orderNumber.replace(/^[A-Za-z]+-/, "");
  const kotId = `KOT-${shortOrderId}-${String(targetRound).padStart(2, "0")}`;

  const isTakeaway = Boolean(
    options?.isTakeaway ||
    order.tableNumber === "TAKEAWAY" ||
    (order as any).isTakeaway ||
    (order as any).orderType === "TAKEAWAY" ||
    (order.notes || "").includes("[TAKEAWAY]") ||
    (order.notes || "").includes("[PARCEL]")
  );
  const isPrivateOrder = Boolean(
    options?.isPrivateOrder ||
      (order as any).isPrivate ||
      order.orderType === "PRIVATE" ||
      (order.notes || "").includes("[ORDER_TYPE:PRIVATE]") ||
      (order.orderNumber || "").startsWith("PRV-")
  );
  const purposeMatch = (order.notes || "").match(/\[PRIVATE_PURPOSE:([A-Z_]+)\]/);
  const privatePurpose = order.privatePurpose || (purposeMatch ? purposeMatch[1] : undefined);

  const hasParcel = itemsToPrint.some((it) => it.name.toLowerCase().includes("(parcel)") || (it.notes || "").toLowerCase().includes("parcel"));
  const hasDineIn = itemsToPrint.some((it) => !it.name.toLowerCase().includes("(parcel)") && !(it.notes || "").toLowerCase().includes("parcel"));
  const isMixed = Boolean((hasParcel && hasDineIn) || (order.notes || "").includes("DINE_IN_AND_TAKEAWAY"));

  const cleanSpecialInstructions = (order.notes || "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\|/g, "")
    .trim();
  const privateNoteMatch = (order.notes || "").match(/\[PRIVATE_NOTE:([^\]]+)\]/);
  const mergedInstructions = [
    privateNoteMatch ? privateNoteMatch[1].trim() : "",
    cleanSpecialInstructions,
  ]
    .filter((s, idx, arr) => Boolean(s) && arr.indexOf(s) === idx)
    .join(" | ");

  return {
    kotId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    tableNumber: order.tableNumber,
    round: targetRound,
    terminalName,
    dateStr,
    timeStr,
    isTakeaway,
    isPrivateOrder,
    privatePurpose,
    isMixed,
    specialInstructions: mergedInstructions || undefined,
    items: itemsToPrint.map((it) => {
      let itemName = it.name;
      const isItemParcel = itemName.toLowerCase().includes("(parcel)") || (it.notes || "").toLowerCase().includes("parcel");
      if ((!isMixed && isTakeaway && !itemName.toLowerCase().includes("(parcel)")) || (isItemParcel && !itemName.toLowerCase().includes("(parcel)"))) {
        itemName = `${itemName} - (parcel)`;
      }
      return {
        name: itemName,
        quantity: it.quantity || 1,
        notes: it.notes,
      };
    }),
    totalItems,
    totalQuantity,
  };
}


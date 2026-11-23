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
 * Width: 32 columns standard (compact/58mm) or 42 columns (80mm)
 */
export class KotReceiptEngine {
  private static LINE_WIDTH = 32;

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

  static formatPlainSlip(data: KotData): string {
    const width = 32;
    const divider = "-".repeat(width);

    const hasParcelItem = data.items.some((i) => i.name.toLowerCase().includes("(parcel)") || (i.notes || "").toLowerCase().includes("parcel"));
    const hasDineInItem = data.items.some((i) => !i.name.toLowerCase().includes("(parcel)") && !(i.notes || "").toLowerCase().includes("parcel"));
    const isMixedOrder = Boolean(data.isMixed || (hasParcelItem && hasDineInItem));

    const lines: string[] = ["          SPIRAL CAFE"];

    if (data.isPrivateOrder) {
      lines.push("*** PRIVATE ORDER ***");
    } else if (isMixedOrder) {
      lines.push("*** DINE IN & TAKE AWAY ***");
    } else if (data.tableNumber === "TAKEAWAY" || data.isTakeaway || (hasParcelItem && !hasDineInItem)) {
      lines.push("*** TAKE AWAY ***");
    }

    lines.push(`TABLE ${data.tableNumber.toUpperCase()}`);
    lines.push(divider);

    const cleanOrderNum = (data.orderNumber || "").replace(/^#/, "");
    const dateStr = data.dateStr || new Date().toLocaleDateString("en-GB");
    lines.push(this.formatLine(`Order: #${cleanOrderNum}`, `Date: ${dateStr}`, width));

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
        data.tableNumber === "TAKEAWAY" ||
        (!isMixedOrder && Boolean(data.isTakeaway));
      const cleanName = item.name
        .replace(/\s*-\s*\(parcel\)/gi, "")
        .replace(/\s*-\s*\(dine in\)/gi, "")
        .replace(/\s*\(parcel\)/gi, "")
        .replace(/\s*\(dine in\)/gi, "")
        .replace(/\s*\[parcel\]/gi, "")
        .replace(/\s*\[dine in\]/gi, "")
        .trim();
      const tag = isItemParcel ? "(Parcel)" : "(Dine In)";
      const fullName = `${cleanName} - ${tag}`;
      const qtyStr = String(item.quantity);
      const maxFirstLine = width - qtyStr.length - 1;
      const wrapped = this.wrapText(fullName, maxFirstLine);
      const firstLine = wrapped[0] || fullName.substring(0, maxFirstLine);
      lines.push(this.formatLine(firstLine, qtyStr, width));
      for (let i = 1; i < wrapped.length; i++) {
        lines.push(wrapped[i]);
      }

      // Print legitimate kitchen customization notes, but skip redundant dine-in/parcel tags
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
      lines.push("SPECIAL REQUEST:");
      lines.push(`"${cleanInst}"`);
    }

    lines.push(divider);
    lines.push("        —— ORDER SLIP ——");

    return lines.join("\n");
  }

  /**
   * Generates standard ESC/POS binary command string for 58mm thermal receipt printer
   * Formatted to match the approved physical reference design.
   */
  static generateEscPosCommands(data: KotData): string {
    const ESC = "\x1B";
    const GS = "\x1D";
    const width = 32;

    let commands = "";

    // 1. Initialize printer
    commands += `${ESC}@`;

    // 2. Set character code page to standard PC437, Font A (12x24), Normal 1x1 size, and default line spacing
    commands += `${ESC}t\x00`;
    commands += `${ESC}M\x00`; // Standard Font A
    commands += `${GS}!\x00`;  // Normal size (1x width, 1x height)
    commands += `${ESC}2`;     // Default line spacing
    commands += `${ESC}E\x00`; // Bold OFF
    commands += `${GS}B\x00`;  // Reverse OFF

    const hasParcelItem = data.items.some((i) => i.name.toLowerCase().includes("(parcel)") || (i.notes || "").toLowerCase().includes("parcel"));
    const hasDineInItem = data.items.some((i) => !i.name.toLowerCase().includes("(parcel)") && !(i.notes || "").toLowerCase().includes("parcel"));
    const isMixedOrder = Boolean(data.isMixed || (hasParcelItem && hasDineInItem));

    // Centered SPIRAL CAFE in bold
    commands += `${ESC}a\x01`; // Center
    commands += `${ESC}E\x01`; // Bold ON
    commands += `SPIRAL CAFE\n`;

    // Reverse color banner for DINE IN & TAKE AWAY
    commands += `${GS}B\x01`; // Reverse ON
    if (data.isPrivateOrder) {
      commands += ` *** PRIVATE ORDER *** \n`;
    } else if (isMixedOrder) {
      commands += ` *** DINE IN & TAKE AWAY *** \n`;
    } else if (data.tableNumber === "TAKEAWAY" || data.isTakeaway || (hasParcelItem && !hasDineInItem)) {
      commands += ` *** TAKE AWAY *** \n`;
    } else {
      commands += ` *** DINE IN *** \n`;
    }
    commands += `${GS}B\x00`; // Reverse OFF

    // Large Bold Table Number
    commands += `${GS}!\x11`; // Double size
    commands += `TABLE ${data.tableNumber.toUpperCase()}\n`;
    commands += `${GS}!\x00`; // Normal size
    commands += `${ESC}E\x00`; // Bold OFF

    // Divider
    const divider = "-".repeat(width);
    commands += `${divider}\n`;

    // Order: #106 | Date: DD/MM/YYYY
    commands += `${ESC}a\x00`; // Align Left
    const cleanOrderNum = (data.orderNumber || "").replace(/^#/, "");
    const dateStr = data.dateStr || new Date().toLocaleDateString("en-GB");
    const orderText = `Order: #${cleanOrderNum}`;
    const dateText = `Date: ${dateStr}`;
    const sp = Math.max(1, width - orderText.length - dateText.length);
    commands += `${ESC}E\x01`;
    commands += orderText;
    commands += `${ESC}E\x00`;
    commands += `${" ".repeat(sp)}${dateText}\n`;

    if (data.round && data.round > 1) {
      commands += `Round: ${data.round} (Add-on Order)\n`;
    }

    commands += `${divider}\n`;
    commands += `${ESC}E\x01`;
    commands += `${this.formatLine("ITEM", "QTY", width)}\n`;
    commands += `${ESC}E\x00`;
    commands += `${divider}\n`;

    // Items with (Dine In) / (Parcel)
    const isTakeaway = data.tableNumber === "TAKEAWAY" || (!isMixedOrder && Boolean(data.isTakeaway));
    data.items.forEach((item) => {
      const isItemParcel =
        item.name.toLowerCase().includes("(parcel)") ||
        (item.notes || "").toLowerCase().includes("parcel") ||
        isTakeaway;
      const cleanName = item.name
        .replace(/\s*-\s*\(parcel\)/gi, "")
        .replace(/\s*-\s*\(dine in\)/gi, "")
        .replace(/\s*\(parcel\)/gi, "")
        .replace(/\s*\(dine in\)/gi, "")
        .replace(/\s*\[parcel\]/gi, "")
        .replace(/\s*\[dine in\]/gi, "")
        .trim();
      const tag = isItemParcel ? "(Parcel)" : "(Dine In)";
      const fullName = `${cleanName} - ${tag}`;

      commands += `${GS}!\x00`;  // Normal size (1x width, 1x height)
      commands += `${ESC}E\x01`; // Bold ON
      const qtyStr = String(item.quantity);
      const maxFirstLine = width - qtyStr.length - 1;
      const wrapped = this.wrapText(fullName, maxFirstLine);
      const firstLine = wrapped[0] || fullName.substring(0, maxFirstLine);
      commands += `${this.formatLine(firstLine, qtyStr, width)}\n`;
      for (let i = 1; i < wrapped.length; i++) {
        commands += `${wrapped[i]}\n`;
      }
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

    commands += `${divider}\n`;
    commands += `${ESC}E\x01`;
    commands += `${this.formatLine(`Total Items: ${data.totalItems}`, `Total Qty: ${data.totalQuantity}`, width)}\n`;
    commands += `${ESC}E\x00`;

    if (data.specialInstructions && data.specialInstructions.trim()) {
      const cleanInst = data.specialInstructions.trim().replace(/^"+|"+$/g, "");
      commands += `${divider}\n`;
      commands += `${ESC}E\x01`;
      commands += `SPECIAL REQUEST:\n`;
      commands += `${ESC}E\x00`;
      commands += `"${cleanInst}"\n`;
    }

    commands += `${divider}\n`;
    commands += `${ESC}a\x01`; // Center
    commands += `${ESC}E\x01`;
    commands += `—— ORDER SLIP ——\n`;
    commands += `${ESC}E\x00`;

    // Minimal paper feed (2 lines) and cut
    commands += `\n\n`;
    commands += `${GS}V\x00`;

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
  const isPrivateOrder = Boolean(options?.isPrivateOrder || (order as any).isPrivate);

  const hasParcel = itemsToPrint.some((it) => it.name.toLowerCase().includes("(parcel)") || (it.notes || "").toLowerCase().includes("parcel"));
  const hasDineIn = itemsToPrint.some((it) => !it.name.toLowerCase().includes("(parcel)") && !(it.notes || "").toLowerCase().includes("parcel"));
  const isMixed = Boolean((hasParcel && hasDineIn) || (order.notes || "").includes("DINE_IN_AND_TAKEAWAY"));

  const cleanSpecialInstructions = (order.notes || "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\|/g, "")
    .trim();

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
    isMixed,
    specialInstructions: cleanSpecialInstructions || undefined,
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


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

  static formatPlainSlip(data: KotData): string {
    const divider = "-".repeat(this.LINE_WIDTH);

    const hasParcelItem = data.items.some((i) => i.name.toLowerCase().includes("(parcel)") || (i.notes || "").toLowerCase().includes("parcel"));
    const hasDineInItem = data.items.some((i) => !i.name.toLowerCase().includes("(parcel)") && !(i.notes || "").toLowerCase().includes("parcel"));
    const isMixedOrder = Boolean(data.isMixed || (hasParcelItem && hasDineInItem));

    let headerTitle = `TABLE ${data.tableNumber.toUpperCase()}`;
    if (data.isPrivateOrder) {
      headerTitle = "*** PRIVATE ORDER ***";
    } else if (isMixedOrder) {
      headerTitle = `*** DINE IN & TAKE AWAY ***\nTABLE ${data.tableNumber.toUpperCase()}`;
    } else if (data.tableNumber === "TAKEAWAY") {
      headerTitle = "*** TAKE AWAY ***";
    } else if (data.isTakeaway || hasParcelItem) {
      headerTitle = `TABLE ${data.tableNumber.toUpperCase()} (PARCEL)`;
    }

    const cleanOrderNum = (data.orderNumber || "").replace(/^#/, "");
    const lines: string[] = [
      headerTitle,
      `Order: ${cleanOrderNum} | ${data.timeStr}`,
    ];

    if (data.round && data.round > 1) {
      lines.push(`Round: ${data.round} (Add-on)`);
    }

    lines.push(divider);
    lines.push(this.formatLine("ITEM", "QTY"));
    lines.push(divider);

    data.items.forEach((item) => {
      const isTakeaway = data.tableNumber === "TAKEAWAY" || data.isTakeaway;
      let displayName = item.name;
      if (isTakeaway && !displayName.toLowerCase().includes("(parcel)")) {
        displayName = `${displayName} - (parcel)`;
      }

      // Main item name and quantity on right
      lines.push(this.formatLine(displayName.substring(0, 26), String(item.quantity)));

      // Add-on / customization if present, indented below parent
      if (item.notes) {
        const cleanNote = item.notes.replace(/\[[^\]]+\]/g, "").trim();
        if (cleanNote) {
          lines.push(this.formatLine(`  + ${cleanNote}`, `x ${item.quantity}`));
        }
      }
    });

    lines.push(divider);
    lines.push(this.formatLine(`Total Items: ${data.totalItems}`, `Total Qty: ${data.totalQuantity}`));

    if (data.specialInstructions && data.specialInstructions.trim()) {
      const cleanInst = data.specialInstructions.trim().replace(/^"+|"+$/g, "");
      lines.push(divider);
      lines.push("SPECIAL REQUEST:");
      lines.push(`"${cleanInst}"`);
    }

    return lines.join("\n");
  }

  /**
   * Generates standard ESC/POS binary command string for 80mm thermal receipt printer (CN811-UEWB)
   * Formatted with BOLD, double-height dish items and zero clutter for busy kitchen visibility.
   */
  static generateEscPosCommands(data: KotData): string {
    const ESC = "\x1B";
    const GS = "\x1D";

    let commands = "";

    // 1. Initialize printer
    commands += `${ESC}@`;

    // 2. Set character code page to standard PC437
    commands += `${ESC}t\x00`;

    const hasParcelItem = data.items.some((i) => i.name.toLowerCase().includes("(parcel)") || (i.notes || "").toLowerCase().includes("parcel"));
    const hasDineInItem = data.items.some((i) => !i.name.toLowerCase().includes("(parcel)") && !(i.notes || "").toLowerCase().includes("parcel"));
    const isMixedOrder = Boolean(data.isMixed || (hasParcelItem && hasDineInItem));

    // 3. Double-width & Double-height for Table / Type Header
    commands += `${ESC}!\x30`; // double width + double height + bold
    if (data.isPrivateOrder) {
      commands += `*** PRIVATE ORDER ***\n`;
    } else if (isMixedOrder) {
      commands += `*** DINE IN & TAKE AWAY ***\n`;
      commands += `TABLE ${data.tableNumber.toUpperCase()}\n`;
    } else if (data.tableNumber === "TAKEAWAY" || data.isTakeaway || (hasParcelItem && !hasDineInItem)) {
      commands += `*** TAKE AWAY ***\n`;
    } else {
      commands += `TABLE ${data.tableNumber.toUpperCase()}\n`;
    }

    // 4. Reset font to standard Font A
    commands += `${ESC}!\x00`;

    // 5. Compact Order & Time line (no redundant terminal/hash clutter)
    const cleanOrderNum = (data.orderNumber || "").replace(/^#/, "");
    commands += `Order: ${cleanOrderNum}  |  ${data.timeStr}\n`;
    if (data.round && data.round > 1) {
      commands += `Round: ${data.round} (Add-on Order)\n`;
    }

    // 6. Header divider
    const divider = "-".repeat(32);
    commands += `${divider}\n`;
    commands += `${ESC}E\x01`; // Bold ON
    commands += `${this.formatLine("ITEM", "QTY")}\n`;
    commands += `${ESC}E\x00`; // Bold OFF
    commands += `${divider}\n`;

    // 7. Dishes in BOLD & DOUBLE HEIGHT for chefs
    const isTakeaway = data.tableNumber === "TAKEAWAY" || data.isTakeaway;
    data.items.forEach((item) => {
      let displayName = item.name;
      if (isTakeaway && !displayName.toLowerCase().includes("(parcel)")) {
        displayName = `${displayName} - (parcel)`;
      }

      // Double-height + Bold for item line
      commands += `${ESC}!\x10`; // Double-height
      commands += `${ESC}E\x01`; // Bold ON
      commands += `${this.formatLine(displayName.substring(0, 24), String(item.quantity))}\n`;
      commands += `${ESC}E\x00`; // Bold OFF
      commands += `${ESC}!\x00`; // Normal font

      if (item.notes) {
        const cleanNote = item.notes.replace(/\[[^\]]+\]/g, "").trim();
        if (cleanNote) {
          commands += `${this.formatLine(`  + ${cleanNote}`, `x ${item.quantity}`)}\n`;
        }
      }
    });

    // 8. Footer divider & totals
    commands += `${divider}\n`;
    commands += `${ESC}E\x01`; // Bold ON
    commands += `${this.formatLine(`Total Items: ${data.totalItems}`, `Total Qty: ${data.totalQuantity}`)}\n`;
    commands += `${ESC}E\x00`; // Bold OFF

    // Special instructions in BOLD with double quotes
    if (data.specialInstructions && data.specialInstructions.trim()) {
      const cleanInst = data.specialInstructions.trim().replace(/^"+|"+$/g, "");
      commands += `${divider}\n`;
      commands += `${ESC}E\x01`; // Bold ON
      commands += `SPECIAL REQUEST:\n`;
      commands += `${ESC}!\x10`; // Double-height
      commands += `"${cleanInst}"\n`;
      commands += `${ESC}!\x00`; // Normal font
      commands += `${ESC}E\x00`; // Bold OFF
    }

    // 9. Extra line feeds (4 lines) and paper cut
    commands += `\n\n\n\n`;
    commands += `${GS}V\x00`; // ESC/POS standard full cut

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
      if ((isTakeaway || isItemParcel) && !itemName.toLowerCase().includes("(parcel)")) {
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


import { Order, OrderItem, getOrderById } from "./db";
import { supabaseAdmin } from "./supabase/admin";

export interface KotData {
  kotId: string;
  orderId: string;
  orderNumber: string;
  tableNumber: string;
  round: number;
  terminalName: string;
  dateStr: string;
  timeStr: string;
  items: Array<{
    name: string;
    quantity: number;
    notes?: string;
  }>;
  totalItems: number;
  totalQuantity: number;
}

/**
 * Accurately replicates the user's uploaded physical KOT receipt (Image 4)
 * Width: 32 columns standard (compact) or 42 columns (80mm)
 */
export class KotReceiptEngine {
  private static LINE_WIDTH = 32;

  static formatLine(left: string, right: string, width = this.LINE_WIDTH): string {
    const spaceCount = Math.max(1, width - left.length - right.length);
    return `${left}${" ".repeat(spaceCount)}${right}`;
  }

  static formatPlainSlip(data: KotData): string {
    const divider = "-".repeat(this.LINE_WIDTH);

    const lines: string[] = [
      `Table No: ${data.tableNumber}`,
      `Date: ${data.dateStr} ${data.timeStr}`,
      `Terminal : ${data.terminalName || "Billing 1"}`,
      divider,
      this.formatLine("Item", "Qty"),
      divider,
    ];

    data.items.forEach((item) => {
      // Main item name and quantity on right
      lines.push(this.formatLine(item.name.substring(0, 26), String(item.quantity)));

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

    return lines.join("\n");
  }

  /**
   * Generates standard ESC/POS binary command string for 80mm thermal receipt printer (CN811-UEWB)
   */
  static generateEscPosCommands(data: KotData): string {
    const ESC = "\x1B";
    const GS = "\x1D";

    let commands = "";

    // 1. Initialize printer
    commands += `${ESC}@`;

    // 2. Set character code page to standard PC437
    commands += `${ESC}t\x00`;

    // 3. Double-width & Double-height for Table Header
    commands += `${ESC}!\x30`; // double width + double height + bold
    commands += `Table No: ${data.tableNumber}\n`;

    // 4. Reset font to standard Font A
    commands += `${ESC}!\x00`;

    // 5. Date & Terminal
    commands += `Date: ${data.dateStr} ${data.timeStr}\n`;
    commands += `Terminal : ${data.terminalName || "Billing 1"}\n`;

    // 6. Header divider
    const divider = "-".repeat(32);
    commands += `${divider}\n`;
    commands += `${ESC}E\x01`; // Bold ON
    commands += `${this.formatLine("Item", "Qty")}\n`;
    commands += `${ESC}E\x00`; // Bold OFF
    commands += `${divider}\n`;

    // 7. Items
    data.items.forEach((item) => {
      commands += `${this.formatLine(item.name.substring(0, 26), String(item.quantity))}\n`;

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
  terminalName = "Billing 1"
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

  return {
    kotId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    tableNumber: order.tableNumber,
    round: targetRound,
    terminalName,
    dateStr,
    timeStr,
    items: itemsToPrint.map((it) => ({
      name: it.name,
      quantity: it.quantity || 1,
      notes: it.notes,
    })),
    totalItems,
    totalQuantity,
  };
}


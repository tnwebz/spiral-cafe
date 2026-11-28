/**
 * Professional 58mm ESC/POS Thermal Receipt Engine & Formatter
 * Width: 58mm (approx 32 columns in standard monospace font)
 */

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptData {
  invoiceNumber: string;
  orderNumber: string;
  tableNumber: string;
  date: string;
  time: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  packagingFee?: number;
  serviceCharge?: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  cafeName?: string;
  cafeAddress?: string;
  cafePhone?: string;
  gstNumber?: string;
}

export class ThermalReceiptFormatter {
  private static LINE_WIDTH = 32;

  static formatLine(left: string, right: string, width = this.LINE_WIDTH): string {
    const spaceCount = Math.max(1, width - left.length - right.length);
    return `${left}${" ".repeat(spaceCount)}${right}`;
  }

  static centerText(text: string, width = this.LINE_WIDTH): string {
    if (text.length >= width) return text.substring(0, width);
    const leftPad = Math.floor((width - text.length) / 2);
    return " ".repeat(leftPad) + text;
  }

  static generatePlaintextReceipt(data: ReceiptData): string {
    const divider = "-".repeat(this.LINE_WIDTH);

    const rawTable = (data.tableNumber || "A1").toUpperCase();
    const cleanTable = rawTable === "GIVE ON COUNTER" ? "COUNTER" : rawTable;
    const tablePart = `TABLE: ${cleanTable}`;
    const datePart = `DATE: ${data.date}`;
    const tableDateLine =
      tablePart.length + 1 + datePart.length <= this.LINE_WIDTH
        ? this.formatLine(tablePart, datePart, this.LINE_WIDTH)
        : `${tablePart}\n${datePart}`;

    const lines: string[] = [
      this.centerText("Spiral Cafe"),
      divider,
      tableDateLine,
      divider,
      "Item          Qty   Rate     Amt",
      divider,
    ];

    const normalized = (data.items || []).map((item) => {
      const lower = item.name.toLowerCase();
      const isItemParcel = lower.includes("(parcel)") || lower.includes("[parcel]") || cleanTable === "TAKEAWAY";
      const cleanName = item.name
        .replace(/\s*-\s*\(parcel\)/gi, "")
        .replace(/\s*-\s*\(dine in\)/gi, "")
        .replace(/\s*\(parcel\)/gi, "")
        .replace(/\s*\(dine in\)/gi, "")
        .replace(/\s*\[parcel\]/gi, "")
        .replace(/\s*\[dine in\]/gi, "")
        .trim();
      return { item, cleanName, isItemParcel };
    });

    const isMixedServing =
      normalized.some((x) => x.isItemParcel) &&
      normalized.some((x) => !x.isItemParcel) &&
      cleanTable !== "TAKEAWAY";

    normalized.forEach(({ item, cleanName, isItemParcel }) => {
      const displayName =
        isMixedServing || (cleanTable !== "TAKEAWAY" && isItemParcel)
          ? isItemParcel
            ? `${cleanName} (P)`
            : cleanName
          : cleanName;

      const qtyStr = String(item.quantity).padStart(3, " ");
      const prRaw =
        item.unitPrice >= 1000 && Number.isInteger(item.unitPrice)
          ? String(item.unitPrice)
          : item.unitPrice.toFixed(2);
      const prStr = prRaw.padStart(6, " ");
      const amtStr = item.lineTotal.toFixed(2).padStart(7, " ");
      const rightCol = `${qtyStr} ${prStr} ${amtStr}`;
      const firstColMax = Math.max(8, this.LINE_WIDTH - rightCol.length - 1);

      const words = displayName.split(/\s+/);
      let firstLine = "";
      let used = 0;
      for (const w of words) {
        if (!firstLine) {
          firstLine = w.length <= firstColMax ? w : w.substring(0, firstColMax);
          used = 1;
          if (w.length > firstColMax) break;
        } else if ((firstLine + " " + w).length <= firstColMax) {
          firstLine += " " + w;
          used++;
        } else {
          break;
        }
      }

      lines.push(`${firstLine.padEnd(firstColMax, " ")} ${rightCol}`);
      const rem = words.slice(used).join(" ");
      if (rem) {
        let cur = "";
        for (const w of rem.split(/\s+/)) {
          if (!cur) cur = w;
          else if ((cur + " " + w).length <= this.LINE_WIDTH) cur += " " + w;
          else {
            lines.push(cur);
            cur = w;
          }
        }
        if (cur) lines.push(cur);
      }
    });

    lines.push(divider);

    const totalQty = data.items.reduce((s, it) => s + it.quantity, 0);
    const totalItems = data.items.length;
    const totItemsStr = `Total Items: ${totalItems}`;
    const totQtyStr = `Total Qty: ${totalQty}`;
    if (totItemsStr.length + 1 + totQtyStr.length <= this.LINE_WIDTH) {
      lines.push(this.formatLine(totItemsStr, totQtyStr, this.LINE_WIDTH));
    } else {
      lines.push(totItemsStr, totQtyStr);
    }

    lines.push(this.formatLine("Total Summary", data.subtotal.toFixed(2), this.LINE_WIDTH));

    if (data.tax && data.tax > 0) {
      lines.push(this.formatLine("GST Tax", data.tax.toFixed(2), this.LINE_WIDTH));
    }

    if (data.packagingFee && data.packagingFee > 0) {
      lines.push(this.formatLine("Packaging Fee", data.packagingFee.toFixed(2), this.LINE_WIDTH));
    }

    lines.push(divider);
    lines.push(this.formatLine("GRAND TOTAL:", `Rs ${data.grandTotal.toFixed(2)}`, this.LINE_WIDTH));
    lines.push(divider);

    lines.push(this.centerText("Thanks visit again!!!"));

    return lines.join("\n");
  }
}

/**
 * Format any invoice object into 58mm thermal text lines
 */
export function formatReceipt58mm(invoice: any): string {
  if (!invoice) return "";

  const dateObj = invoice.createdAt ? new Date(invoice.createdAt) : new Date();
  const dateStr = dateObj.toLocaleDateString();
  const timeStr = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const receiptData: ReceiptData = {
    invoiceNumber: invoice.invoiceNumber || "INV-000000",
    orderNumber: invoice.orderNumber || "ORD-000000",
    tableNumber: invoice.tableNumber || "A1",
    date: dateStr,
    time: timeStr,
    customerPhone: invoice.customerPhone,
    items: (invoice.items || []).map((it: any) => ({
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice || it.price,
      lineTotal: it.lineTotal || (it.price * it.quantity),
    })),
    subtotal: invoice.subtotal || 0,
    tax: invoice.tax || 0,
    packagingFee: invoice.packagingFee,
    serviceCharge: invoice.serviceCharge,
    grandTotal: invoice.grandTotal || 0,
    paymentMethod: invoice.paymentMethod || "CASH",
    paymentStatus: invoice.paymentStatus || "PAID",
    cafeName: "SPIRAL CAFE",
    cafeAddress: "Chengalpattu, Tamil Nadu",
  };

  return ThermalReceiptFormatter.generatePlaintextReceipt(receiptData);
}

export class BrowserPrintService {
  async printReceipt(): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== "undefined") {
      window.print();
      return { success: true };
    }
    return { success: false, error: "Window is not defined in server environment." };
  }
}

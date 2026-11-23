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

    const cleanTable = (data.tableNumber || "A1").toUpperCase();
    const tablePart = `TABLE: ${cleanTable}`;
    const datePart = `DATE: ${data.date}`;
    const topSp = Math.max(1, this.LINE_WIDTH - tablePart.length - datePart.length);
    const tableDateLine = `${tablePart}${" ".repeat(topSp)}${datePart}`;

    const lines: string[] = [
      this.centerText("Spiral Cafe"),
      divider,
      tableDateLine,
      divider,
      "Item         Qty  Pr.(Rs) Amt(Rs)",
      divider,
    ];

    data.items.forEach((item) => {
      const cleanName = item.name
        .replace(/\s*-\s*\(parcel\)/gi, "")
        .replace(/\s*\(parcel\)/gi, "")
        .replace(/\s*\(dine in\)/gi, "")
        .trim();
      const isItemParcel = item.name.toLowerCase().includes("(parcel)") || cleanTable === "TAKEAWAY";
      const tag = isItemParcel ? "(Parcel)" : "(Dine In)";

      const qtyStr = String(item.quantity).padStart(3, " ");
      const prStr = item.unitPrice.toFixed(2).padStart(7, " ");
      const amtStr = item.lineTotal.toFixed(2).padStart(7, " ");
      const rightCol = `${qtyStr} ${prStr} ${amtStr}`;

      const namePart = cleanName.length > 12 ? cleanName.substring(0, 12) : cleanName.padEnd(12, " ");
      lines.push(`${namePart} ${rightCol}`);
      if (cleanName.length > 12) {
        lines.push(cleanName.substring(12));
      }
      lines.push(`  ${tag}`);
    });

    lines.push(divider);

    const totalQty = data.items.reduce((s, it) => s + it.quantity, 0);
    const totalItems = data.items.length;
    const totItemsStr = `Total Items: ${totalItems}`;
    const totQtyStr = `Total Qty: ${totalQty}`;
    const qtySpaces = Math.max(1, this.LINE_WIDTH - totItemsStr.length - totQtyStr.length);
    lines.push(`${totItemsStr}${" ".repeat(qtySpaces)}${totQtyStr}`);

    const subVal = data.subtotal.toFixed(2);
    const subSp = Math.max(1, this.LINE_WIDTH - "Total Summary".length - subVal.length);
    lines.push(`Total Summary${" ".repeat(subSp)}${subVal}`);

    if (data.tax && data.tax > 0) {
      const taxVal = data.tax.toFixed(2);
      const taxSp = Math.max(1, this.LINE_WIDTH - "GST Tax (5%)".length - taxVal.length);
      lines.push(`GST Tax (5%)${" ".repeat(taxSp)}${taxVal}`);
    }

    if (data.packagingFee && data.packagingFee > 0) {
      const packVal = data.packagingFee.toFixed(2);
      const packSp = Math.max(1, this.LINE_WIDTH - "Packaging Fee".length - packVal.length);
      lines.push(`Packaging Fee${" ".repeat(packSp)}${packVal}`);
    }

    lines.push(divider);
    lines.push(`GRAND TOTAL: Rs ${data.grandTotal.toFixed(2)}`);
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

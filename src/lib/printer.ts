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
    const doubleDivider = "=".repeat(this.LINE_WIDTH);

    const lines: string[] = [
      doubleDivider,
      this.centerText(data.cafeName || "SPIRAL CAFE"),
      this.centerText("ROOFTOP DINE-IN EXPERIENCE"),
      this.centerText("Chengalpattu, Tamil Nadu"),
      divider,
      this.formatLine("Invoice :", data.invoiceNumber),
      this.formatLine("Order   :", data.orderNumber),
      this.formatLine("Table   :", data.tableNumber),
      this.formatLine("Date    :", data.date),
      this.formatLine("Time    :", data.time),
    ];

    if (data.customerPhone) {
      lines.push(this.formatLine("Customer:", data.customerPhone));
    }

    lines.push(divider);
    lines.push(this.formatLine("ITEM", "QTY   AMOUNT"));
    lines.push(divider);

    data.items.forEach((item) => {
      lines.push(item.name.substring(0, 32));
      const qtyAndPrice = `${item.quantity} x ₹${item.unitPrice}`;
      const total = `₹${item.lineTotal}`;
      lines.push(this.formatLine(`  ${qtyAndPrice}`, total));
    });

    lines.push(divider);
    lines.push(this.formatLine("Subtotal:", `₹${data.subtotal}`));
    lines.push(this.formatLine("GST (5%):", `₹${data.tax}`));

    if (data.packagingFee && data.packagingFee > 0) {
      lines.push(this.formatLine("Packaging:", `₹${data.packagingFee}`));
    }

    lines.push(doubleDivider);
    lines.push(this.formatLine("TOTAL:", `₹${data.grandTotal}`));
    lines.push(doubleDivider);

    lines.push(this.formatLine("Payment Method:", data.paymentMethod.toUpperCase()));
    lines.push(this.formatLine("Payment Status:", data.paymentStatus.toUpperCase()));
    lines.push(divider);
    lines.push(this.centerText("THANK YOU FOR DINING WITH US"));
    lines.push(this.centerText("SPIRAL CAFE"));
    lines.push(divider);

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
    tableNumber: invoice.tableNumber || "Table 01",
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

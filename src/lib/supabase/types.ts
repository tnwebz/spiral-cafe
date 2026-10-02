export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus = "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PENDING_CASH" | "PAID" | "FAILED" | "REFUNDED";
export type PaymentMethod = "UNSELECTED" | "CASH" | "ONLINE";
export type AdminRole = "ADMIN" | "KITCHEN" | "CASHIER";

export interface Database {
  public: {
    Tables: {
      cafe_config: {
        Row: {
          id: number;
          tax_percentage: number;
          packaging_fee: number;
          service_charge: number;
          kitchen_pin: string;
          cashier_pin: string;
          admin_pin: string;
          admin_username: string;
          admin_password_hash: string;
          cafe_name: string;
          cafe_address: string;
          cafe_phone: string;
          gst_number: string;
          currency_symbol: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          tax_percentage?: number;
          packaging_fee?: number;
          service_charge?: number;
          kitchen_pin?: string;
          cashier_pin?: string;
          admin_pin?: string;
          admin_username?: string;
          admin_password_hash?: string;
          cafe_name?: string;
          cafe_address?: string;
          cafe_phone?: string;
          gst_number?: string;
          currency_symbol?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          tax_percentage?: number;
          packaging_fee?: number;
          service_charge?: number;
          kitchen_pin?: string;
          cashier_pin?: string;
          admin_pin?: string;
          admin_username?: string;
          admin_password_hash?: string;
          cafe_name?: string;
          cafe_address?: string;
          cafe_phone?: string;
          gst_number?: string;
          currency_symbol?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          name: string;
          description: string;
          price: number;
          original_price: number | null;
          category_id: string;
          category_name: string;
          diet_type: "veg" | "non-veg" | "egg" | "other";
          badge: "none" | "bestseller" | "chef-choice" | "new" | "spicy" | "popular";
          rating: number;
          reviews_count: number;
          image: string;
          cloudinary_public_id: string | null;
          available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string;
          price: number;
          original_price?: number | null;
          category_id: string;
          category_name: string;
          diet_type?: "veg" | "non-veg" | "egg" | "other";
          badge?: "none" | "bestseller" | "chef-choice" | "new" | "spicy" | "popular";
          rating?: number;
          reviews_count?: number;
          image: string;
          cloudinary_public_id?: string | null;
          available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          price?: number;
          original_price?: number | null;
          category_id?: string;
          category_name?: string;
          diet_type?: "veg" | "non-veg" | "egg" | "other";
          badge?: "none" | "bestseller" | "chef-choice" | "new" | "spicy" | "popular";
          rating?: number;
          reviews_count?: number;
          image?: string;
          cloudinary_public_id?: string | null;
          available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          phone_number: string;
          name: string | null;
          service_sms_consent: boolean;
          marketing_consent: boolean;
          total_orders: number;
          total_spent: number;
          first_seen_at: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          phone_number: string;
          name?: string | null;
          service_sms_consent?: boolean;
          marketing_consent?: boolean;
          total_orders?: number;
          total_spent?: number;
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string;
          name?: string | null;
          service_sms_consent?: boolean;
          marketing_consent?: boolean;
          total_orders?: number;
          total_spent?: number;
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_sessions: {
        Row: {
          id: string;
          customer_id: string | null;
          customer_phone: string | null;
          table_number: string;
          session_token: string;
          started_at: string;
          last_active_at: string;
        };
        Insert: {
          id: string;
          customer_id?: string | null;
          customer_phone?: string | null;
          table_number: string;
          session_token: string;
          started_at?: string;
          last_active_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          customer_phone?: string | null;
          table_number?: string;
          session_token?: string;
          started_at?: string;
          last_active_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          table_number: string;
          customer_session_id: string | null;
          customer_id: string | null;
          customer_phone: string | null;
          subtotal: number;
          tax: number;
          packaging_fee: number;
          service_charge: number;
          grand_total: number;
          status: OrderStatus;
          payment_status: PaymentStatus;
          payment_method: PaymentMethod;
          payment_txn_id: string | null;
          payment_provider: string | null;
          invoice_id: string | null;
          invoice_number: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          preparing_at: string | null;
          ready_at: string | null;
          paid_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id: string;
          order_number: string;
          table_number: string;
          customer_session_id?: string | null;
          customer_id?: string | null;
          customer_phone?: string | null;
          subtotal?: number;
          tax?: number;
          packaging_fee?: number;
          service_charge?: number;
          grand_total?: number;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          payment_method?: PaymentMethod;
          payment_txn_id?: string | null;
          payment_provider?: string | null;
          invoice_id?: string | null;
          invoice_number?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          preparing_at?: string | null;
          ready_at?: string | null;
          paid_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          order_number?: string;
          table_number?: string;
          customer_session_id?: string | null;
          customer_id?: string | null;
          customer_phone?: string | null;
          subtotal?: number;
          tax?: number;
          packaging_fee?: number;
          service_charge?: number;
          grand_total?: number;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          payment_method?: PaymentMethod;
          payment_txn_id?: string | null;
          payment_provider?: string | null;
          invoice_id?: string | null;
          invoice_number?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          preparing_at?: string | null;
          ready_at?: string | null;
          paid_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          name: string;
          price: number;
          quantity: number;
          line_total: number;
          image: string | null;
          notes: string | null;
        };
        Insert: {
          id: string;
          order_id: string;
          product_id?: string | null;
          name: string;
          price: number;
          quantity: number;
          line_total: number;
          image?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          name?: string;
          price?: number;
          quantity?: number;
          line_total?: number;
          image?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          order_id: string | null;
          order_number: string;
          table_number: string;
          customer_id: string | null;
          customer_phone: string | null;
          items: Json;
          subtotal: number;
          tax: number;
          packaging_fee: number;
          service_charge: number;
          grand_total: number;
          payment_method: PaymentMethod;
          payment_status: PaymentStatus;
          paid_at: string | null;
          secure_token: string | null;
          sms_sent: boolean;
          sms_sent_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          invoice_number: string;
          order_id?: string | null;
          order_number: string;
          table_number: string;
          customer_id?: string | null;
          customer_phone?: string | null;
          items?: Json;
          subtotal?: number;
          tax?: number;
          packaging_fee?: number;
          service_charge?: number;
          grand_total?: number;
          payment_method?: PaymentMethod;
          payment_status?: PaymentStatus;
          paid_at?: string | null;
          secure_token?: string | null;
          sms_sent?: boolean;
          sms_sent_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          order_id?: string | null;
          order_number?: string;
          table_number?: string;
          customer_id?: string | null;
          customer_phone?: string | null;
          items?: Json;
          subtotal?: number;
          tax?: number;
          packaging_fee?: number;
          service_charge?: number;
          grand_total?: number;
          payment_method?: PaymentMethod;
          payment_status?: PaymentStatus;
          paid_at?: string | null;
          secure_token?: string | null;
          sms_sent?: boolean;
          sms_sent_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          product_id: string | null;
          name: string;
          quantity: number;
          unit_price: number;
          line_total: number;
        };
        Insert: {
          id: string;
          invoice_id: string;
          product_id?: string | null;
          name: string;
          quantity: number;
          unit_price: number;
          line_total: number;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          product_id?: string | null;
          name?: string;
          quantity?: number;
          unit_price?: number;
          line_total?: number;
        };
        Relationships: [];
      };
      settlements: {
        Row: {
          id: string;
          date: string;
          total_orders: number;
          total_sales: number;
          cash_sales: number;
          online_sales: number;
          cash_counted: number;
          cash_settled: number;
          difference: number;
          notes: string | null;
          settled_by: string;
          settled_at: string;
        };
        Insert: {
          id: string;
          date: string;
          total_orders?: number;
          total_sales?: number;
          cash_sales?: number;
          online_sales?: number;
          cash_counted?: number;
          cash_settled?: number;
          difference?: number;
          notes?: string | null;
          settled_by: string;
          settled_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          total_orders?: number;
          total_sales?: number;
          cash_sales?: number;
          online_sales?: number;
          cash_counted?: number;
          cash_settled?: number;
          difference?: number;
          notes?: string | null;
          settled_by?: string;
          settled_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          admin_user: string;
          action: string;
          entity_type: string;
          entity_id: string;
          details: string;
          previous_value: Json | null;
          new_value: Json | null;
          timestamp: string;
        };
        Insert: {
          id: string;
          admin_user: string;
          action: string;
          entity_type: string;
          entity_id: string;
          details: string;
          previous_value?: Json | null;
          new_value?: Json | null;
          timestamp?: string;
        };
        Update: {
          id?: string;
          admin_user?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          details?: string;
          previous_value?: Json | null;
          new_value?: Json | null;
          timestamp?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_order_with_items: {
        Args: {
          order_payload: Json;
          items_payload: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ==========================================
// Application Domain Models (compatible with existing UI/API)
// ==========================================

export interface OrderItem {
  id?: string;
  orderId?: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  image?: string;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  tableNumber: string;
  customerSessionId?: string | null;
  customerId?: string | null;
  customerPhone?: string | null;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  packagingFee: number;
  serviceCharge: number;
  grandTotal: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentTxnId?: string | null;
  paymentProvider?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  preparingAt?: string | null;
  readyAt?: string | null;
  paidAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
}

export interface Customer {
  id: string;
  phoneNumber: string;
  name?: string | null;
  serviceSmsConsent: boolean;
  marketingConsent: boolean;
  totalOrders: number;
  totalSpent: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSession {
  id: string;
  customerId?: string | null;
  customerPhone?: string | null;
  tableNumber: string;
  sessionToken: string;
  startedAt: string;
  lastActiveAt: string;
}

export interface InvoiceItemSnapshot {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId?: string | null;
  orderNumber: string;
  tableNumber: string;
  customerId?: string | null;
  customerPhone?: string | null;
  items: InvoiceItemSnapshot[];
  subtotal: number;
  tax: number;
  packagingFee: number;
  serviceCharge: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAt?: string | null;
  secureToken?: string | null;
  smsSent: boolean;
  smsSentAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Settlement {
  id: string;
  date: string;
  totalOrders: number;
  totalSales: number;
  cashSales: number;
  onlineSales: number;
  cashCounted: number;
  cashSettled: number;
  difference: number;
  notes?: string | null;
  settledBy: string;
  settledAt: string;
}

export interface DynamicMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number | null;
  categoryId: string;
  categoryName: string;
  dietType: "veg" | "non-veg" | "egg" | "other";
  badge: "none" | "bestseller" | "chef-choice" | "new" | "spicy" | "popular";
  rating: number;
  reviewsCount: number;
  image: string;
  storagePath?: string | null;
  cloudinaryPublicId?: string | null;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  adminUser: string;
  action: string;
  entityType: "ORDER" | "PAYMENT" | "INVOICE" | "MENU_ITEM" | "SETTLEMENT" | "CONFIG";
  entityId: string;
  details: string;
  previousValue?: any;
  newValue?: any;
  timestamp: string;
}

export interface CafeConfig {
  taxPercentage: number;
  packagingFee: number;
  serviceCharge: number;
  kitchenPin: string;
  cashierPin: string;
  adminPin: string;
  adminUsername: string;
  adminPasswordHash: string;
  cafeName: string;
  cafeAddress: string;
  cafePhone: string;
  gstNumber: string;
  currencySymbol: string;
}


export interface OrderItem {
  id: string
  order_id: string
  listing_id?: string | null
  farmer_id?: string | null
  farmer_name: string
  commodity_name: string
  category: string
  hub_name: string
  quantity_kg: number
  unit_price: number
  moq_kg: number
  line_total: number
}

export interface Order {
  id: string
  receipt_number: string
  consumer_id: string
  consumer_name: string
  consumer_email: string
  order_tier: "B2C" | "B2B"
  fulfillment_type: "pickup" | "delivery"
  distance_km: number
  notes: string
  subtotal: number
  service_fee: number
  delivery_fee: number
  total_amount: number
  status: string
  created_at: number
  items: OrderItem[]
  grower_subtotal?: number
  grower_qty_kg?: number
}

export interface CheckoutPayload {
  items: { listing_id: string; quantity_kg: number }[]
  order_tier: "B2C" | "B2B"
  fulfillment_type: "pickup" | "delivery"
  distance_km: number
  notes: string
}

export interface MemoBreakdownItem {
  order_id: string
  receipt_number: string
  consumer_name: string
  commodity_name: string
  category: string
  hub_name: string
  quantity_kg: number
  unit_price: number
  line_total: number
  created_at: number
}

export interface SalesMemo {
  id: string
  memo_number: string
  farmer_id: string
  farmer_name: string
  farmer_email: string
  period_type: "daily" | "monthly"
  period_key: string
  total_orders: number
  total_items_sold: number
  total_qty_kg: number
  gross_sales: number
  notes: string
  created_by: string
  created_at: number
  items: MemoBreakdownItem[]
}

export interface MemoPreview {
  farmer_id: string
  farmer_name: string
  farmer_email: string
  period_type: "daily" | "monthly"
  period_key: string
  total_orders: number
  total_items_sold: number
  total_qty_kg: number
  gross_sales: number
  items: MemoBreakdownItem[]
}

export interface GrowerSaleItem extends OrderItem {
  receipt_number: string
  consumer_name: string
  fulfillment_type: string
  created_at: number
}

export interface GrowerSalesSummary {
  total_orders: number
  total_qty_kg: number
  total_revenue: number
  items: GrowerSaleItem[]
}

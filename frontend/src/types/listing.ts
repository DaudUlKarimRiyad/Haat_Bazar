// Haat_Bazar Product Batch Listing Types & Interfaces

export type QualityGrade = "GRADE_A" | "GRADE_B" | "GRADE_C_PROCESSING"

export type ProduceCategory =
  | "Vegetables"
  | "Tubers"
  | "Fruits"
  | "Grains"
  | "Leafy Greens"
  | "Spices"

export interface ProductListing {
  id: string
  farmer_id?: string
  farmer_name: string
  hub_id?: string
  hub_name: string
  commodity_name: string
  category: ProduceCategory | string
  total_yield_kg: number
  available_qty_kg: number
  farmer_unit_price: number // BDT per kg
  b2c_moq_kg: number // Minimum Order Qty for B2C
  b2b_moq_kg: number // Minimum Order Qty for B2B
  grade: QualityGrade
  harvest_date: string // YYYY-MM-DD
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ListingInput = Omit<
  ProductListing,
  "id" | "created_at" | "updated_at"
>

export type ListingPatch = Partial<ListingInput>

export interface ListingPage {
  items: ProductListing[]
  total: number
  offset: number
  limit: number
}

export interface ListingFilterState {
  search: string
  category: string
  grade: string
  onlyActive: boolean
}

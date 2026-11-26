import type { ListingInput, ListingPage, ListingPatch, ProductListing } from "../types/listing"
import type { CheckoutPayload, GrowerSalesSummary, MemoPreview, Order, SalesMemo } from "../types/order"
import { request } from "./http"

export const PAGE_SIZE = 12
export const apiService = {
  getListings(offset = 0, limit = PAGE_SIZE, category?: string, search?: string) {
    const query = new URLSearchParams({offset: String(offset), limit: String(limit)})
    if (category) query.set("category", category)
    if (search) query.set("search", search)
    return request<ListingPage>("/listings?" + query)
  },
  getListing: (id: string) => request<ProductListing>("/listings/" + id),
  createListing: (values: ListingInput) => request<ProductListing>("/listings", "POST", values),
  updateListing: (id: string, values: ListingPatch) => request<ProductListing>("/listings/" + id, "PATCH", values),
  deleteListing: (id: string) => request<void>("/listings/" + id, "DELETE"),

  checkout: (payload: CheckoutPayload) => request<Order>("/orders", "POST", payload),
  getOrders: () => request<Order[]>("/orders"),
  getOrder: (id: string) => request<Order>("/orders/" + id),
  getGrowerSales: () => request<GrowerSalesSummary>("/orders/sales/grower"),

  getMemos: (farmerId?: string, periodType?: string) => {
    const query = new URLSearchParams()
    if (farmerId) query.set("farmer_id", farmerId)
    if (periodType) query.set("period_type", periodType)
    const suffix = query.toString() ? "?" + query.toString() : ""
    return request<SalesMemo[]>("/memos" + suffix)
  },
  getMemo: (id: string) => request<SalesMemo>("/memos/" + id),

  getAdminTransactions: (params: URLSearchParams) =>
    request<{ items: Order[]; total: number }>("/admin/transactions?" + params.toString()),
  exportAdminTransactions: (params: URLSearchParams) =>
    request<Blob>("/admin/transactions/export?" + params.toString()),
  previewMemo: (farmerId: string, periodType: "daily" | "monthly", periodKey: string, tzOffsetMinutes: number) => {
    const query = new URLSearchParams({
      farmer_id: farmerId,
      period_type: periodType,
      period_key: periodKey,
      tz_offset_minutes: String(tzOffsetMinutes),
    })
    return request<MemoPreview>("/admin/memos/preview?" + query.toString())
  },
  createMemo: (payload: {
    farmer_id: string
    period_type: "daily" | "monthly"
    period_key: string
    notes: string
    tz_offset_minutes: number
  }) => request<SalesMemo>("/admin/memos", "POST", payload),
  deleteMemo: (id: string) => request<void>("/admin/memos/" + id, "DELETE"),
}

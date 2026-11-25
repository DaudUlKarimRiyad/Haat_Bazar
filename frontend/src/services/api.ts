import type { ListingInput, ListingPage, ListingPatch, ProductListing } from "../types/listing"
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
}

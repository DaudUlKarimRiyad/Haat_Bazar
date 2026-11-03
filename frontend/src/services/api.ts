// Central API service: all backend HTTP communication happens here.
// Matches the FastAPI endpoint conventions:
// GET    /api/v1/listings           (Read List with pagination & filters)
// POST   /api/v1/listings           (Create Single)
// GET    /api/v1/listings/{id}      (Read Single)
// PATCH  /api/v1/listings/{id}      (Update Single)
// DELETE /api/v1/listings/{id}      (Delete Single)

import type {
  ListingInput,
  ListingPage,
  ListingPatch,
  ProductListing,
} from "../types/listing"
import { INITIAL_LISTINGS } from "./mockData"

export const PAGE_SIZE = 12
const BASE = "/api/v1/listings"
const STORAGE_KEY = "haat_bazar_listings_store"

// Initialize local storage store if empty
const getLocalStore = (): ProductListing[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_LISTINGS))
      return INITIAL_LISTINGS
    }
    return JSON.parse(raw)
  } catch {
    return INITIAL_LISTINGS
  }
}

const saveLocalStore = (items: ProductListing[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

// FastAPI error extractor: formats 404 string or 422 validation array
const errorMessage = async (res: Response): Promise<string> => {
  try {
    const { detail } = await res.json()
    if (typeof detail === "string") return detail
    if (Array.isArray(detail)) {
      return detail
        .map((d: { loc: string[]; msg: string }) => `${d.loc.at(-1)}: ${d.msg}`)
        .join("; ")
    }
  } catch {
    // response body wasn't JSON
  }
  return `Request failed with status ${res.status}`
}

// Standard fetch wrapper with fallback to offline storage for demo resilience
const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2000)

  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(await errorMessage(res))
    }
    return res.status === 204 ? (undefined as T) : await res.json()
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    // If backend isn't reachable during standalone frontend demo, throw to trigger fallback
    throw err
  }
}

export const apiService = {
  // Read List with offset & limit
  getListings: async (
    offset = 0,
    limit = PAGE_SIZE,
    category?: string,
    search?: string
  ): Promise<ListingPage> => {
    try {
      const params = new URLSearchParams()
      params.set("offset", String(offset))
      params.set("limit", String(limit))
      if (category && category !== "ALL") params.set("category", category)
      if (search) params.set("search", search)

      return await request<ListingPage>(`${BASE}?${params.toString()}`)
    } catch {
      // Offline / Local Mock Fallback
      let items = getLocalStore()
      if (category && category !== "ALL") {
        items = items.filter(
          (i) => i.category.toLowerCase() === category.toLowerCase()
        )
      }
      if (search) {
        const query = search.toLowerCase()
        items = items.filter(
          (i) =>
            i.commodity_name.toLowerCase().includes(query) ||
            i.farmer_name.toLowerCase().includes(query) ||
            i.hub_name.toLowerCase().includes(query)
        )
      }
      const total = items.length
      const paged = items.slice(offset, offset + limit)
      return { items: paged, total, offset, limit }
    }
  },

  // Read Single
  getListing: async (id: string): Promise<ProductListing> => {
    try {
      return await request<ProductListing>(`${BASE}/${id}`)
    } catch {
      const items = getLocalStore()
      const found = items.find((i) => i.id === id)
      if (!found) {
        throw new Error(`Commodity listing with id '${id}' not found`)
      }
      return found
    }
  },

  // Create Single
  createListing: async (data: ListingInput): Promise<ProductListing> => {
    try {
      return await request<ProductListing>(BASE, {
        method: "POST",
        body: JSON.stringify(data),
      })
    } catch {
      const items = getLocalStore()
      const now = new Date().toISOString()
      const newListing: ProductListing = {
        ...data,
        id: crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}`,
        created_at: now,
        updated_at: now,
      }
      items.unshift(newListing)
      saveLocalStore(items)
      return newListing
    }
  },

  // Update Single
  updateListing: async (
    id: string,
    patch: ListingPatch
  ): Promise<ProductListing> => {
    try {
      return await request<ProductListing>(`${BASE}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      })
    } catch {
      const items = getLocalStore()
      const index = items.findIndex((i) => i.id === id)
      if (index === -1) {
        throw new Error(`Commodity listing with id '${id}' not found`)
      }
      const updated: ProductListing = {
        ...items[index],
        ...patch,
        updated_at: new Date().toISOString(),
      }
      items[index] = updated
      saveLocalStore(items)
      return updated
    }
  },

  // Delete Single
  deleteListing: async (id: string): Promise<void> => {
    try {
      await request<void>(`${BASE}/${id}`, { method: "DELETE" })
    } catch {
      const items = getLocalStore()
      const filtered = items.filter((i) => i.id !== id)
      saveLocalStore(filtered)
    }
  },

  // Reset to initial demo seed (convenient utility for assessment viva)
  resetDemoData: async (): Promise<void> => {
    saveLocalStore(INITIAL_LISTINGS)
  },
}

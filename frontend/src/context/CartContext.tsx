import { createContext, useContext, useEffect, useState } from "react"
import { useSession } from "../services/http"
import type { ProductListing } from "../types/listing"

export interface CartEntry {
  listing: ProductListing
  quantity_kg: number
}

interface CartContextValue {
  items: CartEntry[]
  addItem: (listing: ProductListing, quantity_kg?: number) => void
  updateQuantity: (listingId: string, quantity_kg: number) => void
  removeItem: (listingId: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const storageKey = session ? `haat-cart-${session.user.id}` : ""
  const [items, setItems] = useState<CartEntry[]>([])

  useEffect(() => {
    if (!storageKey || session?.user.role !== "consumer") {
      setItems([])
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      setItems(raw ? JSON.parse(raw) : [])
    } catch {
      setItems([])
    }
  }, [storageKey, session?.user.role])

  useEffect(() => {
    if (storageKey && session?.user.role === "consumer") {
      localStorage.setItem(storageKey, JSON.stringify(items))
    }
  }, [items, storageKey, session?.user.role])

  const addItem = (listing: ProductListing, quantity_kg?: number) => {
    const qty = Math.max(quantity_kg ?? listing.b2c_moq_kg, listing.b2c_moq_kg)
    setItems((prev) => {
      const existing = prev.find((e) => e.listing.id === listing.id)
      if (existing) {
        return prev.map((e) =>
          e.listing.id === listing.id
            ? { listing, quantity_kg: Number((e.quantity_kg + qty).toFixed(2)) }
            : e
        )
      }
      return [...prev, { listing, quantity_kg: qty }]
    })
  }

  const updateQuantity = (listingId: string, quantity_kg: number) => {
    setItems((prev) =>
      prev.map((e) => (e.listing.id === listingId ? { ...e, quantity_kg } : e))
    )
  }

  const removeItem = (listingId: string) => {
    setItems((prev) => prev.filter((e) => e.listing.id !== listingId))
  }

  const clearCart = () => setItems([])

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}

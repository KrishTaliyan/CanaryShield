/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "./api";

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartValue {
  items: CartLine[];
  totalItems: number;
  totalPrice: number;
  quantityOf: (productId: string) => number;
  addProduct: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
  clearCart: () => void;
  /** The slide-in cart panel. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartValue | null>(null);
const storageKey = "quickcart.cart";

function loadCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((line) => line?.product?.id && typeof line.product.price === "number" && Number.isInteger(line.quantity) && line.quantity > 0)
      : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(loadCart);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Keep the cart across page reloads in this browser.
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Storage blocked: the cart still works for this visit.
    }
  }, [items]);

  const value = useMemo<CartValue>(() => ({
    items,
    totalItems: items.reduce((total, line) => total + line.quantity, 0),
    totalPrice: items.reduce((total, line) => total + line.product.price * line.quantity, 0),
    quantityOf: (productId) => items.find((line) => line.product.id === productId)?.quantity ?? 0,
    addProduct: (product, quantity = 1) => setItems((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + quantity } : line);
      }
      return [...current, { product, quantity }];
    }),
    setQuantity: (productId, quantity) => setItems((current) => quantity < 1
      ? current.filter((line) => line.product.id !== productId)
      : current.map((line) => line.product.id === productId ? { ...line, quantity } : line)),
    removeProduct: (productId) => setItems((current) => current.filter((line) => line.product.id !== productId)),
    clearCart: () => setItems([]),
    drawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
  }), [items, drawerOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}

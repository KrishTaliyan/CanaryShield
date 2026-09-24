/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Product } from "./api";

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartValue {
  items: CartLine[];
  totalItems: number;
  totalPrice: number;
  addProduct: (product: Product) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const value = useMemo<CartValue>(() => ({
    items,
    totalItems: items.reduce((total, line) => total + line.quantity, 0),
    totalPrice: items.reduce((total, line) => total + line.product.price * line.quantity, 0),
    addProduct: (product) => setItems((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...current, { product, quantity: 1 }];
    }),
    setQuantity: (productId, quantity) => setItems((current) => quantity < 1
      ? current.filter((line) => line.product.id !== productId)
      : current.map((line) => line.product.id === productId ? { ...line, quantity } : line)),
    removeProduct: (productId) => setItems((current) => current.filter((line) => line.product.id !== productId)),
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}

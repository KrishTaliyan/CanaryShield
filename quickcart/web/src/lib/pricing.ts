/** How the shop prices an order. The amount charged is the total. */
export const taxRate = 0.05;
export const deliveryFee = 40;
export const freeDeliveryFrom = 499;

export const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const currencyExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface OrderTotals {
  subtotal: number;
  taxes: number;
  delivery: number;
  total: number;
}

export function orderTotals(subtotal: number): OrderTotals {
  if (subtotal <= 0) return { subtotal: 0, taxes: 0, delivery: 0, total: 0 };
  const taxes = Math.round(subtotal * taxRate * 100) / 100;
  const delivery = subtotal >= freeDeliveryFrom ? 0 : deliveryFee;
  return { subtotal, taxes, delivery, total: Math.round((subtotal + taxes + delivery) * 100) / 100 };
}

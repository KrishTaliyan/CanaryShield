import { currency, currencyExact, freeDeliveryFrom, orderTotals, taxRate } from "../lib/pricing";
import { TruckIcon } from "./Icons";

/** Subtotal, taxes, delivery and total. The total is what the shopper pays. */
export default function OrderSummary({ subtotal, itemCount }: { subtotal: number; itemCount: number }) {
  const totals = orderTotals(subtotal);
  const toFree = freeDeliveryFrom - subtotal;
  return (
    <div className="space-y-3 text-sm">
      <dl className="space-y-2">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Subtotal · {itemCount} item{itemCount === 1 ? "" : "s"}</dt>
          <dd className="font-medium tabular text-ink">{currency.format(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Taxes (GST {Math.round(taxRate * 100)}%)</dt>
          <dd className="font-medium tabular text-ink">{currencyExact.format(totals.taxes)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Delivery</dt>
          <dd className="font-medium tabular text-ink">{totals.delivery === 0 ? <span className="text-success">Free</span> : currency.format(totals.delivery)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <dt className="font-semibold text-ink">Total</dt>
          <dd className="text-xl font-bold tabular text-ink">{currencyExact.format(totals.total)}</dd>
        </div>
      </dl>
      {subtotal > 0 && toFree > 0 && (
        <p className="flex items-center gap-2 rounded-control bg-saffron-soft px-3 py-2 text-[13px] text-ink">
          <TruckIcon size={16} className="shrink-0 text-saffron" />
          Add {currency.format(toFree)} more for free delivery.
        </p>
      )}
    </div>
  );
}

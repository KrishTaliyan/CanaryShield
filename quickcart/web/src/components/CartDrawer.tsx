import { Link } from "react-router-dom";
import { useCart } from "../cart";
import { buttonClass } from "../lib/button";
import { currency } from "../lib/pricing";
import Dialog from "./Dialog";
import DishPlate from "./DishPlate";
import { ArrowRightIcon, CartIcon, TrashIcon } from "./Icons";
import OrderSummary from "./OrderSummary";
import QuantityStepper from "./QuantityStepper";

/** Slide-in cart, opened from the header. */
export default function CartDrawer() {
  const { items, totalItems, totalPrice, setQuantity, removeProduct, drawerOpen, closeDrawer } = useCart();

  return (
    <Dialog open={drawerOpen} onClose={closeDrawer} title={`Your cart (${totalItems})`} placement="right">
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <span className="well inline-flex h-16 w-16 items-center justify-center rounded-full text-ink-subtle"><CartIcon size={28} /></span>
          <p className="text-base font-semibold text-ink">Your cart is empty</p>
          <p className="text-sm text-ink-muted">Add something delicious from the menu.</p>
          <button type="button" onClick={closeDrawer} className={buttonClass("primary", "md", "mt-2")}>Browse the menu</button>
        </div>
      ) : (
        <div className="flex min-h-full flex-col">
          <ul className="flex-1 divide-y divide-line/70 px-5">
            {items.map((line) => (
              <li key={line.product.id} className="flex items-center gap-3 py-4">
                <DishPlate productId={line.product.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{line.product.name}</p>
                  <p className="text-xs tabular text-ink-muted">{currency.format(line.product.price)} each</p>
                  <div className="mt-2 flex items-center gap-2">
                    <QuantityStepper size="sm" label={line.product.name} value={line.quantity} onChange={(value) => setQuantity(line.product.id, value)} />
                    <button type="button" aria-label={`Remove ${line.product.name}`} onClick={() => removeProduct(line.product.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-control text-ink-subtle hover:bg-danger-soft hover:text-danger">
                      <TrashIcon size={15} />
                    </button>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular text-ink">{currency.format(line.product.price * line.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="sticky bottom-0 space-y-4 border-t border-line/70 bg-surface px-5 py-5">
            <OrderSummary subtotal={totalPrice} itemCount={totalItems} />
            <Link to="/checkout" onClick={closeDrawer} className={buttonClass("primary", "lg", "w-full")}>
              Go to checkout <ArrowRightIcon size={16} />
            </Link>
            <Link to="/cart" onClick={closeDrawer} className="block text-center text-sm font-medium text-ink-muted hover:text-brand">View full cart</Link>
          </div>
        </div>
      )}
    </Dialog>
  );
}

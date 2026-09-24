import { Link } from "react-router-dom";
import { useCart } from "../cart";
import DishPlate from "../components/DishPlate";
import { ArrowLeftIcon, ArrowRightIcon, CartIcon, TrashIcon } from "../components/Icons";
import OrderSummary from "../components/OrderSummary";
import QuantityStepper from "../components/QuantityStepper";
import { buttonClass } from "../lib/button";
import { currency } from "../lib/pricing";

export default function Cart() {
  const { items, totalItems, totalPrice, setQuantity, removeProduct, clearCart } = useCart();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"><ArrowLeftIcon size={15} /> Continue shopping</Link>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Your cart <span className="text-ink-subtle">({totalItems})</span></h1>

      {items.length === 0 ? (
        <section className="surface mt-6 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="well inline-flex h-16 w-16 items-center justify-center rounded-full text-ink-subtle"><CartIcon size={28} /></span>
          <p className="text-base font-semibold text-ink">Your cart is empty</p>
          <Link className={buttonClass("primary", "md")} to="/">Browse the menu</Link>
        </section>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="surface p-0" aria-label="Items">
            <ul className="divide-y divide-line/70">
              {items.map((line) => (
                <li className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap" key={line.product.id}>
                  <DishPlate productId={line.product.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{line.product.name}</p>
                    <p className="mt-0.5 text-xs tabular text-ink-muted">{currency.format(line.product.price)} each</p>
                  </div>
                  <QuantityStepper size="sm" label={line.product.name} value={line.quantity} onChange={(value) => setQuantity(line.product.id, value)} />
                  <div className="w-20 text-right text-sm font-semibold tabular text-ink">{currency.format(line.product.price * line.quantity)}</div>
                  <button
                    aria-label={`Remove ${line.product.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-subtle hover:bg-danger-soft hover:text-danger"
                    onClick={() => removeProduct(line.product.id)}
                    type="button"
                  ><TrashIcon size={16} /></button>
                </li>
              ))}
            </ul>
            <div className="border-t border-line/70 px-4 py-3 text-right">
              <button type="button" onClick={clearCart} className="text-sm font-medium text-ink-muted hover:text-danger">Empty cart</button>
            </div>
          </section>

          <section className="surface h-fit space-y-4 p-5 lg:sticky lg:top-24" aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="text-base font-semibold text-ink">Order summary</h2>
            <OrderSummary subtotal={totalPrice} itemCount={totalItems} />
            <Link to="/checkout" className={buttonClass("primary", "lg", "w-full")}>Checkout <ArrowRightIcon size={16} /></Link>
          </section>
        </div>
      )}
    </div>
  );
}

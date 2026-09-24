import { Link } from "react-router-dom";
import { useCart } from "../cart";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const foodEmojis: Record<string, string> = {
  p1: "🍛",
  p2: "🫓",
  p3: "🍢",
  p4: "🥘",
  p5: "🥙",
  p6: "🍱",
  p7: "🥟",
  p8: "🍩",
};

export default function Cart() {
  const { items, totalItems, totalPrice, setQuantity, removeProduct } = useCart();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7">
        <p className="text-sm font-medium text-emerald-800">Your order</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-950">Cart <span className="text-neutral-500">({totalItems})</span></h1>
      </header>

      {items.length === 0 ? (
        <section className="border-y border-neutral-200 py-12 text-center">
          <p aria-hidden="true" className="text-4xl">🛒</p>
          <p className="mt-3 text-sm font-medium text-neutral-900">Your cart is empty</p>
          <Link className="mt-4 inline-flex rounded bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900" to="/">Browse food</Link>
        </section>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200 bg-white">
            {items.map((line) => (
              <li className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap" key={line.product.id}>
                <div aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded bg-amber-100 text-3xl">{foodEmojis[line.product.id] ?? "🍽️"}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-950">{line.product.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">{currency.format(line.product.price)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={`Decrease ${line.product.name} quantity`}
                    className="grid h-8 w-8 place-items-center rounded border border-neutral-300 text-base text-neutral-800 hover:bg-neutral-100"
                    onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                    type="button"
                  >−</button>
                  <span aria-live="polite" className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                  <button
                    aria-label={`Increase ${line.product.name} quantity`}
                    className="grid h-8 w-8 place-items-center rounded border border-neutral-300 text-base text-neutral-800 hover:bg-neutral-100"
                    onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                    type="button"
                  >+</button>
                </div>
                <div className="w-24 text-right text-sm font-semibold tabular-nums text-neutral-900">{currency.format(line.product.price * line.quantity)}</div>
                <button
                  aria-label={`Remove ${line.product.name}`}
                  className="text-sm font-medium text-red-800 underline decoration-red-300 underline-offset-2 hover:text-red-950"
                  onClick={() => removeProduct(line.product.id)}
                  type="button"
                >Remove</button>
              </li>
            ))}
          </ul>

          <section className="h-fit border-y border-neutral-200 bg-white p-5" aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="text-base font-semibold text-neutral-950">Order summary</h2>
            <div className="mt-4 flex justify-between gap-4 border-t border-neutral-200 pt-4 text-sm">
              <span className="text-neutral-600">Subtotal ({totalItems} items)</span>
              <span className="font-semibold tabular-nums text-neutral-950">{currency.format(totalPrice)}</span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPayment, type PayResponse } from "../api";
import { useCart } from "../cart";
import { usePersona } from "../components/PersonaSwitcher";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function Checkout() {
  const { items, totalItems, totalPrice, clearCart } = useCart();
  const { selectedPersona, loading: loadingPersonas, error: personaError } = usePersona();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submitPayment() {
    if (!selectedPersona || items.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result: PayResponse = await createPayment({
        user: {
          userId: selectedPersona.userId,
          country: selectedPersona.country,
          plan: selectedPersona.plan,
          betaUser: selectedPersona.betaUser,
        },
        items: items.map(({ product, quantity }) => ({ productId: product.id, qty: quantity })),
        amount: totalPrice,
      });
      // Keep the cart after a failed payment so the shopper can try again.
      if (result.status === "confirmed") clearCart();
      navigate("/confirmation", { state: { payment: result } });
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Payment could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7">
        <p className="text-sm font-medium text-emerald-800">Review and pay</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-950">Checkout</h1>
      </header>
      {personaError && <p className="mb-4 border-y border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{personaError}</p>}
      {error && <p className="mb-4 border-y border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{error}</p>}
      {items.length === 0 ? (
        <section className="border-y border-neutral-200 py-10">
          <p className="text-sm text-neutral-700">Your cart is empty.</p>
          <Link className="mt-3 inline-flex rounded bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900" to="/">Browse food</Link>
        </section>
      ) : (
        <section className="border-y border-neutral-200 bg-white" aria-labelledby="checkout-summary">
          <h2 id="checkout-summary" className="border-b border-neutral-200 px-4 py-3 text-base font-semibold text-neutral-950">Order summary</h2>
          <ul className="divide-y divide-neutral-200 px-4">
            {items.map(({ product, quantity }) => (
              <li className="flex justify-between gap-4 py-3 text-sm" key={product.id}>
                <span className="min-w-0 truncate text-neutral-700">{product.name} x {quantity}</span>
                <span className="shrink-0 font-medium tabular-nums text-neutral-950">{currency.format(product.price * quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 px-4 py-4">
            <span className="text-sm text-neutral-600">Total · {totalItems} items</span>
            <span className="text-base font-semibold tabular-nums text-neutral-950">{currency.format(totalPrice)}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-4">
            <span className="text-sm text-neutral-600">Persona: {selectedPersona?.name ?? (loadingPersonas ? "Loading..." : "Unavailable")}</span>
            <button
              className="rounded bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedPersona || loadingPersonas || submitting}
              onClick={() => void submitPayment()}
              type="button"
            >{submitting ? "Processing…" : "Pay now"}</button>
          </div>
        </section>
      )}
    </main>
  );
}

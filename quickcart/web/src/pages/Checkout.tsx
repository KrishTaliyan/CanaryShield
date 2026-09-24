import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPayment, type PayResponse } from "../api";
import { useCart } from "../cart";
import DishPlate from "../components/DishPlate";
import FlowStatus from "../components/FlowStatus";
import { AlertIcon, ArrowLeftIcon, CartIcon, CheckIcon, ShieldIcon, UserIcon } from "../components/Icons";
import OrderSummary from "../components/OrderSummary";
import { usePersona } from "../components/PersonaSwitcher";
import { buttonClass } from "../lib/button";
import { currency, currencyExact, orderTotals } from "../lib/pricing";

/** What the confirmation page receives in the navigation state. */
interface ConfirmationState {
  payment: PayResponse;
  amount: number;
  itemCount: number;
  shopper: string;
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="surface p-5" aria-labelledby={`step-${number}`}>
      <h2 id={`step-${number}`} className="mb-4 flex items-center gap-3 text-base font-semibold text-ink">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-fg" aria-hidden="true">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function Checkout() {
  const { items, totalItems, totalPrice, clearCart } = useCart();
  const { personas, selectedPersona, selectPersona, loading: loadingPersonas, error: personaError } = usePersona();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const totals = orderTotals(totalPrice);

  async function submitPayment() {
    if (!selectedPersona || items.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payment = await createPayment({
        user: {
          userId: selectedPersona.userId,
          country: selectedPersona.country,
          plan: selectedPersona.plan,
          betaUser: selectedPersona.betaUser,
        },
        items: items.map(({ product, quantity }) => ({ productId: product.id, qty: quantity })),
        amount: totals.total,
      });
      // Keep the cart after a failed payment so the shopper can try again.
      if (payment.status === "confirmed") clearCart();
      const state: ConfirmationState = { payment, amount: totals.total, itemCount: totalItems, shopper: selectedPersona.name };
      navigate("/confirmation", { state });
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Payment could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <span className="well mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full text-ink-subtle"><CartIcon size={28} /></span>
        <h1 className="mt-4 text-2xl font-bold text-ink">Nothing to check out yet</h1>
        <p className="mt-2 text-sm text-ink-muted">Add a dish or two first.</p>
        <Link className={buttonClass("primary", "md", "mt-6")} to="/">Browse the menu</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/cart" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"><ArrowLeftIcon size={15} /> Back to cart</Link>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Checkout</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-5">
          <Step number={1} title="Who is paying">
            {personaError && <p className="mb-3 text-sm text-danger" role="alert">{personaError}</p>}
            {loadingPersonas ? (
              <div className="grid gap-2 sm:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-16" />)}</div>
            ) : (
              <div role="radiogroup" aria-label="Shopper" className="grid gap-2 sm:grid-cols-2">
                {personas.map((persona) => {
                  const checked = persona.userId === selectedPersona?.userId;
                  return (
                    <button
                      key={persona.userId}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => selectPersona(persona.userId)}
                      className={`flex items-center gap-3 rounded-control border p-3 text-left transition-all duration-200 ease-soft ${checked ? "border-brand/50 bg-brand-soft/60 shadow-inset" : "border-line bg-surface-2 hover:border-brand/30"}`}
                    >
                      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${checked ? "bg-brand text-brand-fg" : "bg-sunken text-ink-muted"}`} aria-hidden="true">
                        {checked ? <CheckIcon size={16} /> : <UserIcon size={16} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{persona.name}</span>
                        <span className="block truncate text-xs text-ink-muted">{persona.country} · {persona.plan}{persona.betaUser ? " · beta" : ""}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-xs text-ink-subtle">Demo shoppers. Who pays decides which payment flow CanaryShield assigns.</p>
          </Step>

          <Step number={2} title="Payment">
            <FlowStatus persona={selectedPersona} />
            <p className="mt-4 rounded-control bg-sunken/70 px-3 py-2 text-xs text-ink-muted">Payments in this demo are simulated. No card is needed and no money moves.</p>
          </Step>

          <Step number={3} title="Your items">
            <ul className="divide-y divide-line/70">
              {items.map(({ product, quantity }) => (
                <li className="flex items-center gap-3 py-3 text-sm" key={product.id}>
                  <DishPlate productId={product.id} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-ink">{product.name} <span className="text-ink-muted">× {quantity}</span></span>
                  <span className="shrink-0 font-semibold tabular text-ink">{currency.format(product.price * quantity)}</span>
                </li>
              ))}
            </ul>
          </Step>
        </div>

        <aside className="surface h-fit space-y-4 p-5 lg:sticky lg:top-24" aria-labelledby="pay-heading">
          <h2 id="pay-heading" className="text-base font-semibold text-ink">Order total</h2>
          <OrderSummary subtotal={totalPrice} itemCount={totalItems} />
          {error && (
            <p className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
              <AlertIcon size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          <button
            className={buttonClass("primary", "lg", "w-full")}
            disabled={!selectedPersona || loadingPersonas || submitting}
            onClick={() => void submitPayment()}
            type="button"
          >
            {submitting ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> Processing payment…</>
            ) : (
              <>Pay {currencyExact.format(totals.total)}</>
            )}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-ink-subtle">
            <ShieldIcon size={13} className="text-brand" /> Paying as {selectedPersona?.name ?? "…"}
          </p>
        </aside>
      </div>
    </div>
  );
}

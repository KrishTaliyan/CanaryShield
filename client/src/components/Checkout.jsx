import ProductCard from "./ProductCard";

function OldCheckout({ user }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-950 p-5 shadow-lg">
      <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Checkout</h2>
          <p className="text-sm text-gray-500">Stable experience</p>
        </div>
        <span className="rounded bg-gray-800 px-2 py-1 text-xs font-semibold text-gray-300">
          Old UI
        </span>
      </div>

      <ProductCard compact />

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Subtotal</span>
          <span>INR {user.cartValue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Delivery</span>
          <span>INR 120</span>
        </div>
        <div className="flex justify-between border-t border-gray-800 pt-3 text-lg font-bold text-white">
          <span>Total</span>
          <span>INR {(user.cartValue + 120).toLocaleString()}</span>
        </div>
      </div>

      <button
        type="button"
        className="mt-5 w-full rounded-lg bg-gray-200 px-4 py-3 font-bold text-gray-950 transition hover:bg-white"
      >
        Place Order
      </button>
    </div>
  );
}

function NewCheckout({ user }) {
  const discount = Math.round(user.cartValue * 0.12);
  const total = user.cartValue - discount;

  return (
    <div className="checkout-enter rounded-xl border border-emerald-400/40 bg-gray-950 p-5 shadow-2xl shadow-emerald-950/30">
      <div className="mb-4 overflow-hidden rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
              Feature Enabled for You
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">One-tap express checkout</h2>
          </div>
          <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-black uppercase text-gray-950">
            New UI
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-800">
          <div className="animate-progress h-full rounded-full bg-emerald-300" />
        </div>
      </div>

      <ProductCard />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {["Address", "Payment", "Review"].map((step, index) => (
          <div
            key={step}
            className="rounded-lg border border-gray-700 bg-gray-900 p-3 text-center"
          >
            <p className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300 text-sm font-black text-gray-950">
              {index + 1}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
              {step}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-gray-700 bg-gray-900 p-4">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Subtotal</span>
          <span>INR {user.cartValue.toLocaleString()}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm text-emerald-300">
          <span>Canary discount</span>
          <span>- INR {discount.toLocaleString()}</span>
        </div>
        <div className="mt-3 flex justify-between border-t border-gray-700 pt-3 text-xl font-black text-white">
          <span>Total</span>
          <span>INR {total.toLocaleString()}</span>
        </div>
      </div>

      <button
        type="button"
        className="mt-5 w-full rounded-xl bg-emerald-300 px-4 py-4 font-black text-gray-950 shadow-lg shadow-emerald-950/40 transition hover:-translate-y-0.5 hover:bg-emerald-200"
      >
        Pay Securely
      </button>
    </div>
  );
}

function Checkout({ showNewUi, user }) {
  return showNewUi ? <NewCheckout user={user} /> : <OldCheckout user={user} />;
}

export default Checkout;

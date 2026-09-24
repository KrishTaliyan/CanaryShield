function NewCheckout({ user }) {
  const discount = Math.round(user.cartTotal * 0.2);
  const total = user.cartTotal - discount;

  return (
    <div className="checkout-enter rounded-xl border border-emerald-400 bg-emerald-500/10 p-5 shadow-xl shadow-emerald-950/20">
      <div className="mb-5 overflow-hidden rounded-xl border border-emerald-400/40 bg-[rgb(var(--panel))] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black text-emerald-400">NEW UI</p>
            <h3 className="mt-1 text-3xl font-black text-[rgb(var(--text))]">One-click checkout</h3>
          </div>
          <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-gray-950">
            20% OFF
          </span>
        </div>
        <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-400">
          Feature Enabled
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {["Cart", "Address", "Pay"].map((step, index) => (
          <div
            key={step}
            className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--field))] p-3 text-center"
          >
            <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400 text-sm font-black text-gray-950">
              {index + 1}
            </span>
            <p className="mt-2 text-xs font-bold uppercase text-[rgb(var(--muted))]">
              {step}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--panel))] p-4">
        <div className="flex justify-between text-sm text-[rgb(var(--muted))]">
          <span>Order total</span>
          <span>INR {user.cartTotal.toLocaleString()}</span>
        </div>
        <div className="mt-3 flex justify-between text-sm font-semibold text-emerald-400">
          <span>Canary discount</span>
          <span>- INR {discount.toLocaleString()}</span>
        </div>
        <div className="mt-4 flex justify-between border-t border-[rgb(var(--line))] pt-4 text-xl font-black text-[rgb(var(--text))]">
          <span>Total</span>
          <span>INR {total.toLocaleString()}</span>
        </div>
      </div>

      <button
        type="button"
        className="mt-5 w-full rounded-xl bg-emerald-400 px-4 py-4 font-black text-gray-950 shadow-lg shadow-emerald-950/20 transition duration-300 hover:-translate-y-0.5 hover:bg-emerald-300"
      >
        One-click Pay
      </button>
    </div>
  );
}

export default NewCheckout;

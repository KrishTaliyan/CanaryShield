function OldCheckout({ user }) {
  return (
    <div className="checkout-enter rounded-xl border border-slate-400/40 bg-[rgb(var(--field))] p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-red-400">OLD UI</p>
          <h3 className="mt-1 text-3xl font-black text-[rgb(var(--text))]">Classic checkout</h3>
        </div>
        <span className="rounded-lg bg-gray-500/15 px-3 py-1 text-xs font-bold text-[rgb(var(--muted))]">
          Stable
        </span>
      </div>

      <div className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-4">
        <div className="flex justify-between gap-4 text-sm text-[rgb(var(--muted))]">
          <span>Order total</span>
          <span>INR {user.cartTotal.toLocaleString()}</span>
        </div>
        <div className="mt-3 flex justify-between gap-4 border-t border-[rgb(var(--line))] pt-3 text-sm text-[rgb(var(--muted))]">
          <span>Delivery</span>
          <span>INR 99</span>
        </div>
        <div className="mt-4 flex justify-between gap-4 border-t border-[rgb(var(--line))] pt-4 text-lg font-bold text-[rgb(var(--text))]">
          <span>Total</span>
          <span>INR {(user.cartTotal + 99).toLocaleString()}</span>
        </div>
      </div>

      <button
        type="button"
        className="mt-5 w-full rounded-lg bg-gray-700 px-4 py-3 font-bold text-white transition hover:bg-gray-600"
      >
        Pay Now
      </button>
    </div>
  );
}

export default OldCheckout;

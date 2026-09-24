import { Link, useLocation } from "react-router-dom";
import type { PayResponse } from "../api";
import PaymentBadge from "../components/PaymentBadge";

interface ConfirmationState {
  payment?: PayResponse;
}

export default function Confirmation() {
  const { state } = useLocation();
  const payment = (state as ConfirmationState | null)?.payment;

  if (!payment) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-neutral-950">No order to show</h1>
        <Link className="mt-4 inline-flex text-sm font-medium text-emerald-800 underline" to="/">Return to menu</Link>
      </main>
    );
  }

  const failed = payment.status === "failed";
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <section className={`border-y px-5 py-6 ${failed ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"}`}>
        <p className={`text-sm font-semibold ${failed ? "text-red-800" : "text-emerald-800"}`}>{failed ? "Payment unsuccessful" : "Order confirmed"}</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-950">{failed ? "Your payment could not be completed" : "Thanks for your order"}</h1>
        <div className="mt-4"><PaymentBadge flow={payment.flow} /></div>
        {failed ? (
          <p className="mt-4 text-sm text-red-900">{payment.error.message} ({payment.error.code})</p>
        ) : (
          <p className="mt-4 text-sm text-neutral-700">Order ID <span className="font-mono font-medium text-neutral-950">{payment.orderId}</span></p>
        )}
        <p className="mt-2 text-xs text-neutral-600">Payment took {payment.durationMs} ms.</p>
      </section>
      <Link className="mt-5 inline-flex rounded bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900" to="/">Return to menu</Link>
    </main>
  );
}

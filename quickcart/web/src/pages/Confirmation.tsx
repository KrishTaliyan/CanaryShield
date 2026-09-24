import { Link, useLocation } from "react-router-dom";
import type { PayResponse } from "../api";
import { AlertIcon, CheckIcon, ClockIcon, RefreshIcon, ShieldIcon } from "../components/Icons";
import PaymentBadge from "../components/PaymentBadge";
import { buttonClass } from "../lib/button";
import { explainFlow } from "../lib/flowReasons";
import { currencyExact } from "../lib/pricing";

interface ConfirmationState {
  payment?: PayResponse;
  amount?: number;
  itemCount?: number;
  shopper?: string;
}

export default function Confirmation() {
  const { state } = useLocation();
  const { payment, amount, itemCount, shopper } = (state as ConfirmationState | null) ?? {};

  if (!payment) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-ink">No order to show</h1>
        <p className="mt-2 text-sm text-ink-muted">Order details appear here right after checkout.</p>
        <Link className={buttonClass("primary", "md", "mt-6")} to="/">Back to the menu</Link>
      </div>
    );
  }

  const failed = payment.status === "failed";
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <section className="surface overflow-hidden p-0 animate-rise-in">
        <div className={`px-6 py-8 text-center ${failed ? "bg-danger-soft/70" : "bg-brand-soft/70"}`}>
          <span className={`mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full shadow-raised animate-scale-in ${failed ? "bg-danger text-white" : "bg-brand text-brand-fg"}`} aria-hidden="true">
            {failed ? <AlertIcon size={28} /> : <CheckIcon size={30} />}
          </span>
          <p className={`mt-4 text-sm font-semibold ${failed ? "text-danger" : "text-brand"}`}>{failed ? "Payment unsuccessful" : "Order confirmed"}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{failed ? "Your payment could not be completed" : "Thanks for your order!"}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {failed ? "Nothing was charged. Your cart is still there, so you can try again." : "The kitchen has it. Your food is on its way."}
          </p>
        </div>

        <dl className="divide-y divide-line/70 px-6 text-sm">
          {failed ? (
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-muted">Error</dt>
              <dd className="text-right font-medium text-danger">{payment.error.message} <code className="font-mono text-xs">({payment.error.code})</code></dd>
            </div>
          ) : (
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-muted">Order ID</dt>
              <dd className="break-all font-mono font-semibold text-ink">{payment.orderId}</dd>
            </div>
          )}
          {amount !== undefined && (
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-muted">{failed ? "Amount attempted" : "Amount paid"}</dt>
              <dd className="font-semibold tabular text-ink">
                {currencyExact.format(amount)}
                {itemCount ? <span className="font-normal text-ink-muted"> · {itemCount} item{itemCount === 1 ? "" : "s"}</span> : null}
              </dd>
            </div>
          )}
          {shopper && (
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-muted">Shopper</dt>
              <dd className="text-ink">{shopper}</dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-ink-muted">Payment flow</dt>
            <dd><PaymentBadge flow={payment.flow} /></dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="inline-flex items-center gap-1.5 text-ink-muted"><ClockIcon size={14} /> Processing time</dt>
            <dd className="tabular text-ink">{payment.durationMs} ms</dd>
          </div>
        </dl>

        <div className="border-t border-line/70 bg-surface-2/60 px-6 py-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldIcon size={16} className="text-brand" /> Behind the scenes</p>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            QuickCart asked CanaryShield which payment flow to use. {explainFlow(payment.evaluation.reason)}
            {failed && payment.flow === "new" && " CanaryShield watches the new flow's error rate and switches shoppers back to the classic flow automatically if failures continue."}
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink-subtle">decision: {payment.evaluation.variant} · {payment.evaluation.reason}</p>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {failed && <Link className={buttonClass("primary", "md")} to="/checkout"><RefreshIcon size={16} /> Try again</Link>}
        <Link className={buttonClass(failed ? "secondary" : "primary", "md")} to="/">Back to the menu</Link>
      </div>
    </div>
  );
}

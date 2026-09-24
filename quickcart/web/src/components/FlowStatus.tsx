import type { Persona } from "../api";
import { explainFlow } from "../lib/flowReasons";
import { useCheckoutFlow } from "../lib/useCheckoutFlow";
import { RefreshIcon, ShieldIcon } from "./Icons";
import PaymentBadge from "./PaymentBadge";

/**
 * Live release status of the payment flow for the selected shopper, from
 * QuickCart's GET /api/checkout-flow (which asks CanaryShield).
 */
export default function FlowStatus({ persona, compact }: { persona: Persona | null; compact?: boolean }) {
  const { flow, error, loading, retry } = useCheckoutFlow(persona);

  if (!persona) {
    return <p className="text-sm text-ink-muted">Choose who is paying to see which payment flow they get.</p>;
  }
  if (loading && !flow) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Checking payment flow">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-4 w-full" />
      </div>
    );
  }
  if (error && !flow) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
        <span className="text-danger">Release status unavailable: {error}</span>
        <button type="button" onClick={retry} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><RefreshIcon size={14} />Retry</button>
      </div>
    );
  }
  if (!flow) return null;

  const rollout = flow.rolloutPercentage;
  return (
    <div className="space-y-2.5" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <PaymentBadge flow={flow.flow} />
        {rollout !== null && (
          <span className="text-[13px] text-ink-muted">
            New flow live for <strong className="tabular text-ink">{rollout}%</strong> of shoppers
          </span>
        )}
      </div>
      <p className="text-[13px] text-ink-muted">{explainFlow(flow.reason)}</p>
      {rollout !== null && !compact && (
        <div className="well h-2 overflow-hidden rounded-full p-0" role="progressbar" aria-label="New payment flow rollout" aria-valuenow={rollout} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-info transition-[width] duration-700 ease-soft" style={{ width: `${rollout}%` }} />
        </div>
      )}
      {!compact && (
        <p className="flex items-start gap-1.5 text-xs text-ink-subtle">
          <ShieldIcon size={14} className="mt-0.5 shrink-0 text-brand" />
          Released with CanaryShield: if the new flow starts failing, shoppers are switched back to the classic flow automatically.
        </p>
      )}
    </div>
  );
}

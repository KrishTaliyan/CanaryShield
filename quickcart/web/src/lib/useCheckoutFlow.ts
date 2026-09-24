import { useEffect, useState } from "react";
import { getCheckoutFlow, type CheckoutFlow, type Persona } from "../api";

/**
 * The payment flow the selected shopper would get right now. Each check is a
 * real SDK evaluation, so it refreshes only every 30 s and only while the tab
 * is visible.
 */
export function useCheckoutFlow(persona: Persona | null) {
  const [flow, setFlow] = useState<CheckoutFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!persona) return;
    const controller = new AbortController();
    let timer: number | undefined;
    const load = (first: boolean) => {
      if (!first && document.hidden) {
        timer = window.setTimeout(() => load(false), 30_000);
        return;
      }
      if (first) setLoading(true);
      getCheckoutFlow(persona, controller.signal)
        .then((value) => {
          setFlow(value);
          setError(null);
        })
        .catch((requestError: unknown) => {
          if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Could not check the payment flow.");
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setLoading(false);
          timer = window.setTimeout(() => load(false), 30_000);
        });
    };
    load(true);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [persona, attempt]);

  return { flow, error, loading, retry: () => setAttempt((value) => value + 1) };
}

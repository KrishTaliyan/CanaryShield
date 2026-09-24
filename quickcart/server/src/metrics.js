import { Counter, Histogram, Registry } from "prom-client";

const registry = new Registry();

const paymentRequests = new Counter({
  name: "quickcart_payment_requests_total",
  help: "Total QuickCart payment requests by flow and outcome.",
  labelNames: ["flow", "outcome"],
  registers: [registry],
});

const paymentDuration = new Histogram({
  name: "quickcart_payment_duration_seconds",
  help: "QuickCart payment duration in seconds by flow.",
  labelNames: ["flow"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

for (const flow of ["old", "new"]) {
  for (const outcome of ["success", "error"]) paymentRequests.inc({ flow, outcome }, 0);
  paymentDuration.zero({ flow });
}

export function recordPayment({ flow, outcome, durationMs }) {
  paymentRequests.inc({ flow, outcome });
  paymentDuration.observe({ flow }, durationMs / 1000);
}

export function metricsContentType() {
  return registry.contentType;
}

export function metricsText() {
  return registry.metrics();
}

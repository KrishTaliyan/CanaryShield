import { Router } from "express";
import { performance } from "node:perf_hooks";
import { recordPayment } from "../metrics.js";
import { processLegacyPayment } from "../payment/legacy.js";
import { applyChaos } from "../chaos.js";
import { evaluateFlag } from "../flagClient.js";
import { processV2Payment } from "../payment/v2.js";

const router = Router();

router.post("/", async (request, response) => {
  const { user, items, amount } = request.body ?? {};
  if (
    typeof user?.userId !== "string"
    || user.userId.trim().length === 0
    || !Array.isArray(items)
    || items.length === 0
    || typeof amount !== "number"
    || !Number.isFinite(amount)
    || amount <= 0
  ) {
    return response.status(400).json({
      error: { code: "BAD_REQUEST", message: "A user ID, at least one item, and a positive amount are required." },
    });
  }

  const evaluation = await evaluateFlag("new_payment_flow", user);
  const flow = evaluation.variant === "new" ? "new" : "old";
  const startedAt = performance.now();
  let payment;
  try {
    if (flow === "new") {
      payment = await processV2Payment();
      await applyChaos();
    } else {
      payment = await processLegacyPayment();
    }
  } catch (error) {
    payment = {
      ok: false,
      error: {
        code: error?.code === "GATEWAY_TIMEOUT" ? "GATEWAY_TIMEOUT" : "INTERNAL",
        message: error?.code === "GATEWAY_TIMEOUT" ? "Simulated payment failure" : "Payment could not be processed.",
      },
    };
  }
  const durationMs = Math.round(performance.now() - startedAt);
  const outcome = payment.ok ? "success" : "error";
  recordPayment({ flow, outcome, durationMs });

  if (!payment.ok) {
    return response.status(500).json({
      status: "failed",
      flow,
      error: payment.error,
      evaluation,
      durationMs,
    });
  }

  return response.status(200).json({
    orderId: payment.orderId,
    status: "confirmed",
    flow,
    evaluation,
    durationMs,
  });
});

export default router;

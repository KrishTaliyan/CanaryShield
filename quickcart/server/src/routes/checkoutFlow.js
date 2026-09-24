import { Router } from "express";
import { evaluateFlag } from "../flagClient.js";

const router = Router();

// GET /api/checkout-flow?userId=&country=&plan=&betaUser= tells the shop which
// payment flow this shopper's checkout will use, and how far the new flow is
// rolled out. It uses the same flag client (and 1 s cache) as POST /api/pay.
router.get("/", async (request, response) => {
  const { userId, country, plan, betaUser } = request.query;
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return response.status(400).json({ error: { code: "BAD_REQUEST", message: "A userId query parameter is required." } });
  }

  const context = { userId: userId.trim() };
  if (typeof country === "string" && country) context.country = country;
  if (typeof plan === "string" && plan) context.plan = plan;
  if (betaUser === "true" || betaUser === "false") context.betaUser = betaUser === "true";

  const evaluation = await evaluateFlag("new_payment_flow", context);
  return response.json({
    flagKey: "new_payment_flow",
    flow: evaluation.variant === "new" ? "new" : "old",
    reason: evaluation.reason,
    rolloutPercentage: evaluation.rolloutPercentage,
  });
});

export default router;

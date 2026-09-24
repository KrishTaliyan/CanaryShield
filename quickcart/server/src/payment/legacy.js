import { randomUUID } from "node:crypto";

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function processLegacyPayment() {
  const delayMs = 50 + Math.floor(Math.random() * 101);
  await wait(delayMs);

  if (Math.random() < 0.01) {
    return { ok: false, error: { code: "GATEWAY_ERROR", message: "Payment gateway error" } };
  }

  return { ok: true, orderId: `ord_${randomUUID().slice(0, 8)}` };
}

import { randomUUID } from "node:crypto";

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function processV2Payment() {
  const delayMs = 30 + Math.floor(Math.random() * 71);
  await wait(delayMs);
  return { ok: true, orderId: `ord_${randomUUID().slice(0, 8)}` };
}

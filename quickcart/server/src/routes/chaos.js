import { Router } from "express";
import { getChaosConfig, startChaos, stopChaos } from "../chaos.js";

const router = Router();

function badRequest(response) {
  return response.status(400).json({
    error: { code: "BAD_REQUEST", message: "Chaos values are outside the allowed range." },
  });
}

router.get("/", (_request, response) => {
  response.json(getChaosConfig());
});

router.post("/", (request, response) => {
  const input = request.body ?? {};
  const errorRate = input.errorRate;
  const latencyMs = input.latencyMs ?? 0;
  const latencyRate = input.latencyRate ?? 0;
  const durationSec = input.durationSec ?? 120;

  if (
    typeof errorRate !== "number" || !Number.isFinite(errorRate) || errorRate < 0 || errorRate > 1
    || typeof latencyMs !== "number" || !Number.isInteger(latencyMs) || latencyMs < 0 || latencyMs > 5000
    || typeof latencyRate !== "number" || !Number.isFinite(latencyRate) || latencyRate < 0 || latencyRate > 1
    || typeof durationSec !== "number" || !Number.isInteger(durationSec) || durationSec < 10 || durationSec > 600
  ) return badRequest(response);

  return response.json(startChaos({ errorRate, latencyMs, latencyRate, durationSec }));
});

router.delete("/", (_request, response) => {
  response.json(stopChaos());
});

export default router;

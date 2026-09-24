import cors from "cors";
import express from "express";
import config from "./config.js";
import chaosRouter from "./routes/chaos.js";
import payRouter from "./routes/pay.js";
import personasRouter from "./routes/personas.js";
import productsRouter from "./routes/products.js";
import { warmUpFlagClient } from "./flagClient.js";
import { metricsContentType, metricsText } from "./metrics.js";

const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

app.use("/api/products", productsRouter);
app.use("/api/personas", personasRouter);
app.use("/api/pay", payRouter);
app.use("/internal/chaos", chaosRouter);

app.get("/healthz", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/metrics", async (_request, response, next) => {
  try {
    response.set("Content-Type", metricsContentType());
    response.send(await metricsText());
  } catch (error) {
    next(error);
  }
});

app.use((_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
});

// Errors use the contract format (README 8.1), including malformed JSON bodies.
app.use((error, _request, response, _next) => {
  if (error?.type === "entity.parse.failed") {
    return response.status(400).json({ error: { code: "BAD_REQUEST", message: "Request body must be valid JSON." } });
  }
  console.error(error);
  return response.status(500).json({ error: { code: "INTERNAL", message: "Internal server error." } });
});

app.listen(config.port, () => {
  void warmUpFlagClient();
});

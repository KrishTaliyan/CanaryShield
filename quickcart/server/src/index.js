import cors from "cors";
import express from "express";
import config from "./config.js";
import chaosRouter from "./routes/chaos.js";
import payRouter from "./routes/pay.js";
import personasRouter from "./routes/personas.js";
import productsRouter from "./routes/products.js";
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

app.listen(config.port);
